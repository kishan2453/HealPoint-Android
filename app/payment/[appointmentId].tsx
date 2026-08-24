import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { RAZORPAY_KEY_ID } from '@/lib/env';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import { isPaymentCancelled, openRazorpayCheckout } from '@/lib/razorpay';
import { ApiClientError, toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import { createPaymentOrder, verifyAppointmentPayment } from '@/services/payments';
import type { AppointmentDetails, PaymentStatus } from '@/types';
import type { RazorpayCheckoutOptions } from '@/types/razorpay';

/** UI state machine for one payment attempt. */
type PaymentPhase =
  | 'idle' // summary + "Pay Online"
  | 'creating-order' // order is being created on the backend
  | 'opening-checkout' // native Razorpay checkout is launching
  | 'verifying' // checkout returned; backend is verifying the signature
  | 'success' // backend VERIFIED the signature - payment is really paid
  | 'failed' // checkout failed / verification failed
  | 'cancelled'; // user dismissed the checkout

const PROCESSING_PHASES: PaymentPhase[] = ['creating-order', 'opening-checkout', 'verifying'];

const PROCESSING_LABEL: Record<Exclude<PaymentPhase, 'idle' | 'success' | 'failed' | 'cancelled'>, string> = {
  'creating-order': 'Creating a secure payment...',
  'opening-checkout': 'Opening secure payment window...',
  verifying: 'Verifying your payment...',
};

/**
 * Normalise whatever the backend reports into the canonical payment states
 * (PENDING / SUCCESS / FAILED / CANCELLED / REFUNDED).
 */
function normalizePaymentStatus(value?: string): PaymentStatus | undefined {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return undefined;
  if (key === 'success' || key === 'paid' || key === 'succeeded' || key === 'captured') return 'SUCCESS';
  if (key === 'failed' || key === 'failed_retryable' || key === 'authorization_failed') return 'FAILED';
  if (key === 'cancelled' || key === 'cancel' || key === 'cancelled_order') return 'CANCELLED';
  if (key === 'refunded' || key === 'refund') return 'REFUNDED';
  return 'PENDING';
}

function paymentBadge(status?: PaymentStatus) {
  switch (status) {
    case 'SUCCESS':
      return { label: 'Paid', variant: 'success' as const };
    case 'FAILED':
      return { label: 'Payment failed', variant: 'error' as const };
    case 'CANCELLED':
      return { label: 'Payment cancelled', variant: 'neutral' as const };
    case 'REFUNDED':
      return { label: 'Refunded', variant: 'neutral' as const };
    case 'PENDING':
      return { label: 'Payment pending', variant: 'warning' as const };
    default:
      return { label: 'Not paid', variant: 'neutral' as const };
  }
}

function describePaymentError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const server = error.serverMessage || '';
    // Network/timeout — the API client already produces a clear message.
    if (error.category === 'NETWORK' || error.category === 'TIMEOUT') {
      return toErrorMessage(error);
    }
    // Backend says Razorpay is not configured / temporarily down.
    if (error.status === 503 && /online payment|razorpay|not configured/i.test(server)) {
      return 'Online payment is temporarily unavailable. Please try again shortly or pay at the clinic.';
    }
    // Backend could not create the Razorpay order.
    if (error.status === 502 && /payment order/i.test(server)) {
      return 'Unable to create the payment order. Please try again in a moment.';
    }
    if (/already paid|no further payment/i.test(server)) {
      return 'This appointment is already paid. You do not need to pay again.';
    }
    if (/verification failed|could not be confirmed|not captured/i.test(server)) {
      return 'Payment verification failed. No money has been deducted. Please try again.';
    }
    if (/no longer open for payment/i.test(server)) {
      return 'This appointment is no longer open for payment. Please contact the clinic.';
    }
    if (/cash payment at the clinic/i.test(server)) {
      return 'This appointment is booked for cash payment at the clinic.';
    }
    // A 404 with no server message (e.g. an older backend without the order
    // route) — give the user something actionable instead of "resource not found".
    if (error.category === 'NOT_FOUND' && !server) {
      return 'Unable to start the payment. Please make sure the booking is eligible for online payment and try again.';
    }
    return toErrorMessage(error, 'We could not verify the payment. Please try again.');
  }
  if (error && typeof error === 'object' && 'description' in error) {
    const description = String((error as { description: unknown }).description || '').trim();
    if (description) return description;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The payment could not be completed. Please try again.';
}

function razorpayContact(value?: string): string | undefined {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return undefined;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>();
  const { user } = useAuth();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [errorText, setErrorText] = useState('');
  const [lastPaymentId, setLastPaymentId] = useState('');

  const payingRef = useRef(false);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await appointmentService.getUserAppointmentDetails(appointmentId);
      setAppointment(res.appointmentDetails);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Unable to load payment details.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useScreenFocus(() => {
    // Keep the screen in sync with the backend whenever it regains focus
    // (e.g. returning from the Razorpay checkout or a confirmation screen).
    load();
  });

  const normalizedStatus = normalizePaymentStatus(appointment?.paymentStatus);
  const alreadyPaid = normalizedStatus === 'SUCCESS' || appointment?.payment === true;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)' as never);
    }
  };

  const buildCheckoutOptions = (
    order: { id: string; amount: number; currency: string },
    key: string,
  ): RazorpayCheckoutOptions => ({
    key,
    amount: order.amount,
    currency: order.currency || 'INR',
    order_id: order.id,
    name: 'HealPoint',
    description: `Consultation fee · ${appointment?.doctorName || 'Doctor'}`,
    prefill: {
      name: user?.name,
      email: user?.email,
      contact: razorpayContact(appointment?.patientPhone || user?.phone),
    },
    theme: { color: Palette.primary },
    modal: { confirm_close: true },
    notes: { appointmentId: appointment?._id || appointmentId || '' },
    remember_customer: true,
  });

  const handlePay = async () => {
    if (!appointmentId || payingRef.current) return;
    payingRef.current = true;
    setErrorText('');
    setPhase('creating-order');
    try {
      const orderRes = await createPaymentOrder(appointmentId);
      const order = orderRes.razorpayOrder;
      const key = orderRes.razorpayKey || RAZORPAY_KEY_ID;
      if (!order?.id || !order.amount || !key) {
        throw new Error(
          'Online payment is not configured for this booking yet. Please try again shortly or pay at the clinic.',
        );
      }

      setPhase('opening-checkout');
      const payment = await openRazorpayCheckout(buildCheckoutOptions(order, key));

      // The mobile callback alone is NOT trusted - the backend must verify the
      // Razorpay signature before the booking is marked paid.
      setPhase('verifying');
      await verifyAppointmentPayment({
        appointmentId,
        razorpay_order_id: payment.razorpay_order_id || order.id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature || '',
      });

      setLastPaymentId(payment.razorpay_payment_id);
      try {
        const fresh = await appointmentService.getUserAppointmentDetails(appointmentId);
        setAppointment(fresh.appointmentDetails);
      } catch {
        // Verified already; the fresh fetch is only cosmetic.
      }
      setPhase('success');
    } catch (error) {
      if (isPaymentCancelled(error)) {
        setPhase('cancelled');
      } else {
        setErrorText(describePaymentError(error));
        setPhase('failed');
      }
    } finally {
      payingRef.current = false;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading payment details..." />
      </SafeAreaView>
    );
  }

  if (loadError || !appointment) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={goBack} title="Secure payment" />
        <StateView
          icon="cloud-offline-outline"
          tone="error"
          title="Unable to load payment"
          message={loadError || 'Unable to load the appointment.'}
          action={primaryButton('Try again', load)}
        />
      </SafeAreaView>
    );
  }

  const amount = appointment.amount || 0;
  const badge = paymentBadge(normalizedStatus);
  const bookingClosed = ['cancel', 'missed'].includes(appointment.bookingStatus || '');

  if (alreadyPaid) {
    return renderSuccessState();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header onBack={goBack} title="Secure payment" />

      {bookingClosed ? (
        <StateView
          icon="close-circle-outline"
          tone="error"
          title="Payment unavailable"
          message="This appointment is no longer open for payment. Please contact the clinic for assistance."
          action={primaryButton('Back', goBack)}
        />
      ) : phase === 'failed' ? (
        renderFailedState()
      ) : phase === 'cancelled' ? (
        renderCancelledState()
      ) : (
        renderPaymentForm(badge)
      )}

      <ProcessingOverlay phase={phase} />
    </SafeAreaView>
  );

  function renderSuccessState() {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, styles.stateIconSuccess]}>
            <Ionicons name="checkmark" size={40} color={Palette.white} />
          </View>
          <Text style={styles.stateTitle}>Payment Successful</Text>
          <Text style={styles.stateBody}>Your payment is verified and your appointment is confirmed.</Text>

          <Card padded style={styles.stateCard}>
            {detailRow('Doctor', appointment?.doctorName || 'Doctor')}
            {detailRow('Date', formatDDMMYYYY(appointment?.bookingDate))}
            {detailRow('Time', appointment?.bookingTime || '-')}
            {detailRow('Amount paid', formatINR(amount))}
            {lastPaymentId ? detailRow('Payment ID', lastPaymentId) : null}
            {detailRow('Status', 'Paid & confirmed')}
          </Card>

          <View style={styles.stateActions}>
            <Button
              title="View Appointment"
              onPress={() =>
                router.replace({ pathname: '/appointment/[id]', params: { id: appointment?._id || '' } })
              }
            />
            <Button title="Done" variant="outline" onPress={goBack} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function renderFailedState() {
    return (
      <StateView
        icon="close-circle-outline"
        tone="error"
        title="Payment Failed"
        message={errorText || 'Your payment could not be completed. No money has been deducted.'}
        action={
          <View style={styles.stateActions}>
            <Button title="Retry Payment" onPress={handlePay} />
            <Button title="Back" variant="outline" onPress={goBack} />
          </View>
        }
      />
    );
  }

  function renderCancelledState() {
    return (
      <StateView
        icon="close-outline"
        tone="warning"
        title="Payment Cancelled"
        message="You cancelled the payment. Your appointment is saved - you can pay online anytime or pay at the clinic."
        action={
          <View style={styles.stateActions}>
            <Button title="Try Again" onPress={handlePay} />
            <Button title="Back" variant="outline" onPress={goBack} />
          </View>
        }
      />
    );
  }

  function renderPaymentForm(_badge: ReturnType<typeof paymentBadge>) {
    const extra = appointment as unknown as Record<string, unknown>;
    const taxAmount =
      typeof extra.taxAmount === 'number'
        ? extra.taxAmount
        : typeof extra.taxes === 'number'
          ? extra.taxes
          : undefined;
    const otherCharges =
      typeof extra.otherCharges === 'number'
        ? extra.otherCharges
        : typeof extra.charges === 'number'
          ? extra.charges
          : undefined;
    const total = amount + (taxAmount || 0) + (otherCharges || 0);

    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.statusHead}>
          <View style={styles.statusHeadText}>
            <Text style={styles.statusLabel}>Payment status</Text>
            <Text style={styles.appointmentId}>
              Appointment {appointment?.appointmentId || appointment?._id}
            </Text>
          </View>
          <Badge label={_badge.label} variant={_badge.variant} />
        </View>

        <Card padded>
          <View style={styles.doctorRow}>
            <View style={styles.doctorIcon}>
              <Ionicons name="person" size={22} color={Palette.primary} />
            </View>
            <View style={styles.doctorInfo}>
              <Text style={styles.doctorName}>{appointment?.doctorName || 'Doctor'}</Text>
              <Text style={styles.doctorMeta}>{appointment?.hospitalName || 'HealPoint clinic'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {detailRow('Date', formatDDMMYYYY(appointment?.bookingDate))}
          {detailRow('Time', appointment?.bookingTime || '-')}
        </Card>

        <Card padded>
          <Text style={styles.cardTitle}>Payment summary</Text>
          {detailRow('Consultation fee', formatINR(amount))}
          {taxAmount ? detailRow('Taxes & charges', formatINR(taxAmount)) : null}
          {otherCharges ? detailRow('Other charges', formatINR(otherCharges)) : null}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total amount</Text>
            <Text style={styles.totalValue}>{formatINR(total)}</Text>
          </View>
        </Card>

        <Card padded>
          <View style={styles.securityRow}>
            <Ionicons name="shield-checkmark" size={22} color={Palette.success} />
            <View style={styles.securityText}>
              <Text style={styles.securityTitle}>Secured by Razorpay</Text>
              <Text style={styles.securityBody}>
                You will be taken to a secure Razorpay window to complete the payment using UPI, card or
                netbanking.
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.payArea}>
          <Button
            title={`Pay Online · ${formatINR(total)}`}
            onPress={handlePay}
            loading={phase === 'creating-order' || phase === 'opening-checkout'}
            disabled={total <= 0}
          />
          <Text style={styles.secureNote}>
            Your payment will be confirmed only after the bank verifies it.
          </Text>
        </View>
      </ScrollView>
    );
  }
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

type StateTone = 'success' | 'error' | 'warning';

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color={Palette.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function detailRow(label: string, value: React.ReactNode) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function primaryButton(title: string, onPress: () => void) {
  return <Button title={title} onPress={onPress} />;
}

function StateView({
  icon,
  tone,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: StateTone;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const toneStyles = {
    success: { bg: '#E2F5E9', color: Palette.success },
    error: { bg: '#FDE8E8', color: Palette.error },
    warning: { bg: '#FDF0DC', color: Palette.warning },
  }[tone];
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateIcon, { backgroundColor: toneStyles.bg }]}>
        <Ionicons name={icon} size={36} color={toneStyles.color} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{message}</Text>
      {action ? <View style={styles.stateActions}>{action}</View> : null}
    </View>
  );
}

function ProcessingOverlay({ phase }: { phase: PaymentPhase }) {
  if (!PROCESSING_PHASES.includes(phase)) return null;
  const label = PROCESSING_LABEL[phase as keyof typeof PROCESSING_LABEL];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <View style={styles.overlayCard}>
          <ActivityIndicator size="large" color={Palette.primary} />
          <Text style={styles.overlayText}>{label}</Text>
          {phase === 'verifying' ? (
            <Text style={styles.overlaySub}>Please don&apos;t close the app.</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
  },
  statusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  statusHeadText: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  appointmentId: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  doctorIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.h4,
    color: Palette.text,
  },
  doctorMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  cardTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  detailLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  detailValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  totalValue: {
    ...Typography.h4,
    color: Palette.primaryDark,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  securityText: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    ...Typography.label,
    color: Palette.success,
  },
  securityBody: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  payArea: {
    gap: Spacing.md,
  },
  secureNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  stateIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  stateIconSuccess: {
    backgroundColor: Palette.success,
  },
  stateTitle: {
    ...Typography.h3,
    color: Palette.text,
    textAlign: 'center',
  },
  stateBody: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  stateCard: {
    width: '100%',
    marginTop: Spacing.sm,
  },
  stateActions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  overlayCard: {
    minWidth: 220,
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  overlayText: {
    ...Typography.label,
    color: Palette.text,
    textAlign: 'center',
  },
  overlaySub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: 'center',
  },
});
