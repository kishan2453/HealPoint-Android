/**
 * HealPoint — Smart Patient Care Passport Screen (Flagship Feature)
 *
 * A secure patient-controlled continuity layer that references the patient's
 * existing healthcare journey without creating duplicate medical records.
 *
 * References:
 *  - Appointments (active + history)
 *  - Smart Care Journey (existing component, compact mode)
 *  - Digital Health Wallet
 *  - Health Timeline
 *  - QR Check-In system
 *  - Consultation / Prescription / Reports / Follow-Up
 *  - Family Healthcare (family member selector)
 *  - Consent & Patient Data Access
 *  - Notification/Event Orchestration
 *
 * Does NOT duplicate any medical records.
 * Does NOT create a parallel state machine.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { SmartCareJourney } from "@/components/SmartCareJourney";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { QRCodeCanvas } from "@/components/ui/QRCodeCanvas";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as carePassportService from "@/services/carePassport";
import * as familyService from "@/services/family";
import type {
  Appointment,
  AppointmentDetails,
  CarePassport,
  CarePassportEpisode,
  FamilyMember,
  PassportQRResponse,
  PassportShareRecord,
  PassportAccessEvent,
} from "@/types";

// ---------------------------------------------------------------------------
// Scope labels
// ---------------------------------------------------------------------------
const SCOPE_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: "APPOINTMENT_ONLY",
    label: "Appointment Only",
    description: "Appointment + check-in info",
  },
  {
    value: "CARE_EPISODE",
    label: "Care Episode",
    description: "Appointment + consultation context",
  },
  {
    value: "SHARED_RECORDS",
    label: "Shared Records",
    description: "Explicitly shared documents",
  },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
type StatusVariant = "primary" | "success" | "warning" | "error" | "neutral";

function appointmentStatusVariant(status: string): StatusVariant {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "rescheduled") return "primary";
  if (s === "completed") return "success";
  if (s === "pending") return "warning";
  if (s === "cancel" || s === "cancelled") return "error";
  return "neutral";
}

function appointmentStatusLabel(status: string): string {
  const s = status?.toLowerCase();
  if (s === "cancel") return "Cancelled";
  if (s === "rescheduled") return "Rescheduled";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
}

// ---------------------------------------------------------------------------
// QR Countdown
// ---------------------------------------------------------------------------
function useQrCountdown(expiresAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secondsLeft;
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "Expired";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Passport header — ID card visual language */
function PassportHeader({
  userName,
  memberId,
  familyMemberName,
}: {
  userName: string;
  memberId: string;
  familyMemberName?: string;
}) {
  return (
    <View style={styles.passportHeader}>
      <View style={styles.passportHeaderTop}>
        <View style={styles.passportBranding}>
          <Ionicons name="id-card" size={20} color={Palette.white} />
          <Text style={styles.passportBrandLabel}>HealPoint Care Passport</Text>
        </View>
        <View style={styles.passportChip}>
          <Text style={styles.passportChipText}>SECURE</Text>
        </View>
      </View>
      <View style={styles.passportHeaderBody}>
        <Text style={styles.passportPatientName}>
          {familyMemberName || userName}
        </Text>
        {familyMemberName && (
          <Text style={styles.passportAccountLabel}>Account: {userName}</Text>
        )}
        <Text style={styles.passportMemberId}>
          HP-{memberId.slice(-8).toUpperCase()}
        </Text>
      </View>
      <View style={styles.passportHeaderFooter}>
        <Ionicons
          name="shield-checkmark-outline"
          size={14}
          color="rgba(255,255,255,0.7)"
        />
        <Text style={styles.passportFooterText}>
          Patient-controlled · Consent-authorized
        </Text>
      </View>
    </View>
  );
}

/** Next action card — derived from real appointment state */
function NextActionCard({
  episode,
  onPress,
}: {
  episode: CarePassportEpisode;
  onPress: () => void;
}) {
  const action = episode.nextAction;
  return (
    <Pressable style={styles.nextActionCard} onPress={onPress}>
      <View style={styles.nextActionLeft}>
        <View style={styles.nextActionIconBg}>
          <Ionicons
            name={(action.icon + "-outline") as keyof typeof Ionicons.glyphMap}
            size={22}
            color={Palette.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nextActionTitle}>Next Action</Text>
          <Text style={styles.nextActionLabel}>{action.label}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Palette.primary} />
    </Pressable>
  );
}

/** Active episode card */
function ActiveEpisodeCard({
  episode,
  onPress,
  onPassPress,
}: {
  episode: CarePassportEpisode;
  onPress: () => void;
  onPassPress: () => void;
}) {
  const statusVariant = appointmentStatusVariant(episode.status);
  const statusLabel = appointmentStatusLabel(episode.status);

  return (
    <Card style={styles.episodeCard}>
      {/* Status row */}
      <View style={styles.episodeStatusRow}>
        <Badge label={statusLabel} variant={statusVariant} />
        <Badge
          label={episode.consultationType === "video" ? "Video" : "In-Person"}
          variant="neutral"
        />
      </View>

      {/* Hospital & Doctor */}
      <Text style={styles.episodeHospital} numberOfLines={1}>
        {episode.hospitalName}
      </Text>
      {episode.department ? (
        <Text style={styles.episodeDept} numberOfLines={1}>
          {episode.department}
        </Text>
      ) : null}
      <Text style={styles.episodeDoctor} numberOfLines={1}>
        Dr. {episode.doctorName}
        {episode.doctorSpeciality ? ` · ${episode.doctorSpeciality}` : ""}
      </Text>

      {/* Date & Time */}
      <View style={styles.episodeDateRow}>
        <Ionicons name="calendar-outline" size={14} color={Palette.textMuted} />
        <Text style={styles.episodeDateText}>
          {formatDDMMYYYY(episode.slotDate)} · {episode.slotTime}
        </Text>
      </View>

      {/* Care progress indicators */}
      <View style={styles.progressRow}>
        <ProgressDot label="Payment" done={episode.paymentStatus === "paid"} />
        <ProgressDot label="Check-in" done={episode.checkedIn} />
        <ProgressDot label="Consult" done={episode.hasConsultation} />
        <ProgressDot label="Rx" done={episode.hasPrescription} />
        <ProgressDot label="Report" done={episode.hasReports} />
        <ProgressDot label="Follow-Up" done={episode.hasFollowUp} />
      </View>

      {/* Action buttons */}
      <View style={styles.episodeActions}>
        <Pressable style={styles.episodeActionBtn} onPress={onPress}>
          <Text style={styles.episodeActionText}>View Journey</Text>
        </Pressable>
        <Pressable style={styles.episodePassBtn} onPress={onPassPress}>
          <Ionicons name="card-outline" size={14} color={Palette.primary} />
          <Text style={styles.episodePassText}>Hospital Pass</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function ProgressDot({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.progressDotItem}>
      <View
        style={[
          styles.progressDot,
          done ? styles.progressDotDone : styles.progressDotPending,
        ]}
      />
      <Text style={styles.progressDotLabel}>{label}</Text>
    </View>
  );
}

/** Recent episode row */
function EpisodeRow({
  episode,
  onPress,
}: {
  episode: CarePassportEpisode;
  onPress: () => void;
}) {
  const statusVariant = appointmentStatusVariant(episode.status);
  const statusLabel = appointmentStatusLabel(episode.status);
  return (
    <Pressable style={styles.episodeRow} onPress={onPress}>
      <View style={styles.episodeRowLeft}>
        <View style={styles.episodeRowIcon}>
          <Ionicons name="medical-outline" size={18} color={Palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.episodeRowHospital} numberOfLines={1}>
            {episode.hospitalName}
          </Text>
          <Text style={styles.episodeRowDoctor} numberOfLines={1}>
            Dr. {episode.doctorName}
          </Text>
          <Text style={styles.episodeRowDate}>
            {formatDDMMYYYY(episode.slotDate)}
          </Text>
        </View>
      </View>
      <View style={styles.episodeRowRight}>
        <Badge label={statusLabel} variant={statusVariant} />
        <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
      </View>
    </Pressable>
  );
}

/** QR Section */
function PassportQRSection({
  passport,
  familyMemberId,
}: {
  passport: CarePassport;
  familyMemberId: string | null;
}) {
  const [qrData, setQrData] = useState<PassportQRResponse | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>(
    passport.settings?.defaultScope || "APPOINTMENT_ONLY",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = useQrCountdown(qrData?.expiresAt ?? null);

  const genQR = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await carePassportService.generateQR({
        scope: selectedScope as
          | "APPOINTMENT_ONLY"
          | "CARE_EPISODE"
          | "SHARED_RECORDS",
        familyMemberId: familyMemberId,
        expiryMinutes: passport.settings?.qrExpiryMinutes || 15,
      });
      setQrData(res.qr);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedScope, familyMemberId, passport.settings?.qrExpiryMinutes]);

  // Auto-refresh when expired
  useEffect(() => {
    if (secondsLeft === 0 && qrData) {
      setQrData(null);
    }
  }, [secondsLeft, qrData]);

  return (
    <Card style={styles.qrCard}>
      <View style={styles.qrHeader}>
        <Ionicons name="qr-code-outline" size={20} color={Palette.primary} />
        <Text style={styles.qrTitle}>My Care Passport QR</Text>
      </View>

      {/* Scope selector */}
      <View style={styles.scopeRow}>
        {SCOPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.scopeChip,
              selectedScope === opt.value && styles.scopeChipActive,
            ]}
            onPress={() => {
              setSelectedScope(opt.value);
              setQrData(null);
            }}
          >
            <Text
              style={[
                styles.scopeChipText,
                selectedScope === opt.value && styles.scopeChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.scopeDescription}>
        {SCOPE_OPTIONS.find((o) => o.value === selectedScope)?.description}
      </Text>

      {/* QR display area */}
      {qrData && secondsLeft > 0 ? (
        <View style={styles.qrDisplay}>
          <QRCodeCanvas value={qrData.token} size={180} />
          <View style={styles.qrExpiryRow}>
            <Ionicons name="time-outline" size={14} color={Palette.textMuted} />
            <Text style={styles.qrExpiryText}>
              Expires in {formatCountdown(secondsLeft)}
            </Text>
          </View>
          <View style={styles.qrSecurityNote}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={Palette.success}
            />
            <Text style={styles.qrSecurityText}>
              Contains no medical data · Signed · Server-verified
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.qrPlaceholder}>
          {loading ? (
            <ActivityIndicator color={Palette.primary} />
          ) : (
            <>
              <Ionicons
                name="qr-code-outline"
                size={56}
                color={Palette.border}
              />
              {error ? (
                <Text style={styles.qrError}>{error}</Text>
              ) : (
                <Text style={styles.qrPlaceholderText}>
                  Tap to generate a secure, time-limited QR
                </Text>
              )}
            </>
          )}
        </View>
      )}

      <Button
        title={qrData && secondsLeft > 0 ? "Refresh QR" : "Generate QR"}
        onPress={genQR}
        fullWidth={false}
        style={styles.qrButton}
      />
    </Card>
  );
}

/** Access history row */
function AccessEventRow({ event }: { event: PassportAccessEvent }) {
  const scopeLabel =
    SCOPE_OPTIONS.find((o) => o.value === event.scope)?.label || event.scope;
  const roleLabel = event.recipientLabel || event.accessedByRole || "Unknown";
  const date = event.accessedAt
    ? new Date(event.accessedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <View style={styles.accessRow}>
      <View style={styles.accessRowIcon}>
        <Ionicons name="scan-outline" size={16} color={Palette.info} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.accessRowRole}>{roleLabel}</Text>
        <Text style={styles.accessRowScope}>{scopeLabel}</Text>
      </View>
      <Text style={styles.accessRowDate}>{date}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Share management modal
// ---------------------------------------------------------------------------
function ShareManagementModal({
  visible,
  passportId,
  familyMemberId,
  onClose,
}: {
  visible: boolean;
  passportId: string;
  familyMemberId: string | null;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<PassportShareRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await carePassportService.getShares(familyMemberId);
      setShares(res.shares || []);
    } catch {
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [familyMemberId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleRevoke = async (shareId: string) => {
    Alert.alert(
      "Revoke Access",
      "This will immediately block further access with this share token. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await carePassportService.revokeShare(shareId);
              await load();
            } catch (e) {
              Alert.alert("Error", toErrorMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Active Shares</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
        </View>
        {loading ? (
          <Loading />
        ) : shares.length === 0 ? (
          <EmptyState
            title="No Active Shares"
            message="When you share your Care Passport, active tokens will appear here."
          />
        ) : (
          <FlatList
            data={shares}
            keyExtractor={(item) => item.shareId}
            contentContainerStyle={{ padding: Spacing.lg }}
            renderItem={({ item }) => {
              const scopeLabel =
                SCOPE_OPTIONS.find((o) => o.value === item.scope)?.label ||
                item.scope;
              const expires = new Date(item.expiresAt).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );
              return (
                <Card style={styles.shareCard}>
                  <View style={styles.shareCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shareRecipient}>
                        {item.recipientLabel || item.recipientRole}
                      </Text>
                      <Text style={styles.shareScope}>{scopeLabel}</Text>
                      <Text style={styles.shareExpiry}>
                        Expires: {expires}
                        {item.accessCount > 0
                          ? ` · ${item.accessCount} scan${item.accessCount !== 1 ? "s" : ""}`
                          : ""}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.revokeBtn}
                      onPress={() => handleRevoke(item.shareId)}
                    >
                      <Text style={styles.revokeBtnText}>Revoke</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CarePassportScreen() {
  const router = useRouter();
  const { tab, familyMemberId: paramFamilyMemberId } = useLocalSearchParams<{
    tab?: string;
    familyMemberId?: string;
  }>();

  const { user } = useAuth();
  const userId = user?._id || "";
  const userName = user?.name || "Patient";

  const [passport, setPassport] = useState<CarePassport | null>(null);
  const [activeAppointment, setActiveAppointment] =
    useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessHistory, setAccessHistory] = useState<PassportAccessEvent[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // Family member state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    paramFamilyMemberId || "all",
  );

  const familyMemberName =
    selectedMemberId && selectedMemberId !== "all"
      ? familyMembers.find((m) => m._id === selectedMemberId)?.name
      : undefined;

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) return;
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const memberId = selectedMemberId === "all" ? null : selectedMemberId;

        const [passportRes, historyRes, membersRes] = await Promise.allSettled([
          carePassportService.getMyPassport(memberId),
          carePassportService.getAccessLog(10),
          familyService.getFamilyMembers(userId),
        ]);

        if (passportRes.status === "fulfilled") {
          setPassport(passportRes.value.passport);

          // Load the active appointment for the SmartCareJourney component
          if (passportRes.value.passport.activeEpisode) {
            const aptId =
              passportRes.value.passport.activeEpisode.appointmentId;
            try {
              const aptRes =
                await appointmentService.getUserAppointmentDetails(aptId);
              setActiveAppointment(aptRes.appointmentDetails ?? null);
            } catch {
              setActiveAppointment(null);
            }
          } else {
            setActiveAppointment(null);
          }
        } else {
          throw passportRes.reason;
        }

        if (historyRes.status === "fulfilled") {
          setAccessHistory(historyRes.value.history || []);
        }

        if (membersRes.status === "fulfilled") {
          setFamilyMembers(
            Array.isArray(membersRes.value) ? membersRes.value : [],
          );
        }
      } catch (e) {
        setError(toErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, selectedMemberId],
  );

  useScreenFocus(load);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // ---------------------------------------------------------------------------
  // Navigation helpers — all route to existing screens (no duplication)
  // ---------------------------------------------------------------------------
  const goToEpisode = (episode: CarePassportEpisode) => {
    router.push(`/appointment/${episode.appointmentId}` as never);
  };

  const goToPass = (episode: CarePassportEpisode) => {
    router.push(`/appointment/pass/${episode.appointmentId}` as never);
  };

  const goToWallet = () => router.push("/health-wallet" as never);
  const goToTimeline = () => router.push("/health/timeline" as never);
  const goToPrescriptions = () => router.push("/health/prescriptions" as never);
  const goToReports = () => router.push("/health/reports" as never);
  const goToFollowUps = () => router.push("/health/follow-ups" as never);

  const handleNextAction = (episode: CarePassportEpisode) => {
    const key = episode.nextAction.key;
    switch (key) {
      case "PAY_NOW":
        router.push(`/payment/${episode.appointmentId}` as never);
        break;
      case "CHECK_IN":
      case "WAITING":
        router.push(`/appointment/pass/${episode.appointmentId}` as never);
        break;
      case "JOIN_CONSULT":
        router.push(`/consultation/${episode.appointmentId}` as never);
        break;
      case "VIEW_PRESCRIPTION":
        goToPrescriptions();
        break;
      case "BOOK_FOLLOWUP":
        goToFollowUps();
        break;
      default:
        goToEpisode(episode);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) return <Loading />;
  if (error && !passport)
    return (
      <ErrorState
        title="Could not load Care Passport"
        message={error}
        onRetry={load}
      />
    );

  const activeEpisode = passport?.activeEpisode ?? null;
  const recentEpisodes = passport?.recentEpisodes ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <DrawerToggleButton />
        <Text style={styles.headerTitle}>Care Passport</Text>
        <Pressable
          onPress={() => setShowShareModal(true)}
          style={styles.headerAction}
        >
          <Ionicons name="share-outline" size={22} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Passport Identity Card */}
        {passport && (
          <PassportHeader
            userName={userName}
            memberId={passport.userId}
            familyMemberName={familyMemberName}
          />
        )}

        {/* Family member filter */}
        {familyMembers.length > 0 && (
          <View style={styles.familyBar}>
            <FamilyMemberFilterBar
              selectedMemberId={selectedMemberId}
              onSelectMember={(id: string) => {
                setSelectedMemberId(id);
              }}
            />
          </View>
        )}

        {/* Active Care Episode */}
        {activeEpisode ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Care Episode</Text>
            <ActiveEpisodeCard
              episode={activeEpisode}
              onPress={() => goToEpisode(activeEpisode)}
              onPassPress={() => goToPass(activeEpisode)}
            />
            {/* Next Action */}
            <NextActionCard
              episode={activeEpisode}
              onPress={() => handleNextAction(activeEpisode)}
            />
          </View>
        ) : null}

        {/* Smart Care Journey (reuse existing component in compact mode) */}
        {activeEpisode && activeAppointment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Care Journey</Text>
            <Card style={{ overflow: "hidden" }}>
              <SmartCareJourney
                appointment={activeAppointment}
                compact
                onPayPress={() =>
                  router.push(
                    `/payment/${activeEpisode.appointmentId}` as never,
                  )
                }
                onCheckInPress={() =>
                  router.push(
                    `/appointment/pass/${activeEpisode.appointmentId}` as never,
                  )
                }
                onJoinMeetPress={() =>
                  router.push(
                    `/consultation/${activeEpisode.appointmentId}` as never,
                  )
                }
                onPrescriptionPress={goToPrescriptions}
                onReportsPress={goToReports}
                onFollowUpPress={goToFollowUps}
              />
            </Card>
          </View>
        ) : null}

        {/* Secure QR Section */}
        {passport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Secure QR</Text>
            <PassportQRSection
              passport={passport}
              familyMemberId={
                selectedMemberId !== "all" ? selectedMemberId : null
              }
            />
          </View>
        )}

        {/* Quick Links to existing modules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <View style={styles.quickGrid}>
            {[
              {
                icon: "wallet-outline",
                label: "Health Wallet",
                onPress: goToWallet,
              },
              {
                icon: "time-outline",
                label: "Timeline",
                onPress: goToTimeline,
              },
              {
                icon: "git-branch-outline",
                label: "Continuity Graph",
                onPress: () => router.push("/health/continuity-graph" as never),
              },
              {
                icon: "document-text-outline",
                label: "Prescriptions",
                onPress: goToPrescriptions,
              },
              {
                icon: "bar-chart-outline",
                label: "Reports",
                onPress: goToReports,
              },
              {
                icon: "refresh-outline",
                label: "Follow-Ups",
                onPress: goToFollowUps,
              },
              {
                icon: "calendar-outline",
                label: "My Appointments",
                onPress: () => router.push("/appointments" as never),
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={styles.quickItem}
                onPress={item.onPress}
              >
                <View style={styles.quickItemIcon}>
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={Palette.primary}
                  />
                </View>
                <Text style={styles.quickItemLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent Episodes */}
        {recentEpisodes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Care Episodes</Text>
            <Card padded={false} style={styles.episodeListCard}>
              {recentEpisodes.map((ep, idx) => (
                <React.Fragment key={ep.appointmentId}>
                  <EpisodeRow episode={ep} onPress={() => goToEpisode(ep)} />
                  {idx < recentEpisodes.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Card>
          </View>
        ) : !activeEpisode ? (
          <View style={styles.section}>
            <EmptyState
              title="No Care History Yet"
              message="Your care episodes will appear here once you book and complete an appointment."
            />
          </View>
        ) : null}

        {/* Access History */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Access History</Text>
            <Pressable onPress={() => setShowShareModal(true)}>
              <Text style={styles.manageLinkText}>Manage Shares</Text>
            </Pressable>
          </View>
          {accessHistory.length > 0 ? (
            <Card padded={false} style={styles.accessCard}>
              {accessHistory.slice(0, 5).map((ev, idx) => (
                <React.Fragment key={idx}>
                  <AccessEventRow event={ev} />
                  {idx < Math.min(accessHistory.length - 1, 4) && (
                    <View style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Card>
          ) : (
            <View style={styles.noAccessNote}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={Palette.success}
              />
              <Text style={styles.noAccessText}>
                No access events yet. When someone scans your Care Passport QR,
                it will appear here.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Share Management Modal */}
      {passport && (
        <ShareManagementModal
          visible={showShareModal}
          passportId={passport.passportId}
          familyMemberId={selectedMemberId !== "all" ? selectedMemberId : null}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerTitle: {
    ...Typography.h3,
    flex: 1,
    textAlign: "center",
    color: Palette.text,
  },
  headerAction: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  // Passport header card
  passportHeader: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.lg,
  },
  passportHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  passportBranding: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  passportBrandLabel: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  passportChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  passportChipText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 9,
  },
  passportHeaderBody: {
    marginBottom: Spacing.md,
  },
  passportPatientName: {
    ...Typography.h2,
    color: Palette.white,
    marginBottom: 2,
  },
  passportAccountLabel: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  passportMemberId: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "monospace",
    letterSpacing: 1.5,
  },
  passportHeaderFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: Spacing.sm,
  },
  passportFooterText: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.65)",
  },
  // Family bar
  familyBar: {
    marginBottom: Spacing.sm,
  },
  // Sections
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  manageLinkText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  // Active episode card
  episodeCard: {
    marginBottom: Spacing.sm,
  },
  episodeStatusRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  episodeHospital: {
    ...Typography.h4,
    color: Palette.text,
  },
  episodeDept: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: 2,
  },
  episodeDoctor: {
    ...Typography.body,
    color: Palette.primary,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  episodeDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  episodeDateText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  progressRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginBottom: Spacing.sm,
  },
  progressDotItem: {
    alignItems: "center",
    gap: 3,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotDone: {
    backgroundColor: Palette.success,
  },
  progressDotPending: {
    backgroundColor: Palette.border,
  },
  progressDotLabel: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
  },
  episodeActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  episodeActionBtn: {
    flex: 1,
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  episodeActionText: {
    ...Typography.button,
    color: Palette.white,
    fontSize: 13,
  },
  episodePassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  episodePassText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  // Next action
  nextActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.primary + "40",
  },
  nextActionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  nextActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  nextActionTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: 2,
  },
  nextActionLabel: {
    ...Typography.body,
    color: Palette.primary,
    fontWeight: "700",
  },
  // QR section
  qrCard: {},
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  qrTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  scopeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    flexWrap: "wrap",
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  scopeChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  scopeChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    fontSize: 11,
  },
  scopeChipTextActive: {
    color: Palette.white,
  },
  scopeDescription: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  qrDisplay: {
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  qrExpiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  qrExpiryText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  qrSecurityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.success + "15",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  qrSecurityText: {
    ...Typography.caption,
    color: Palette.success,
    fontSize: 11,
  },
  qrPlaceholder: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  qrPlaceholderText: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  qrError: {
    ...Typography.caption,
    color: Palette.error,
    textAlign: "center",
  },
  qrButton: {
    alignSelf: "center",
    marginTop: Spacing.sm,
  },
  // Quick grid
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickItem: {
    width: "30%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  quickItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  quickItemLabel: {
    ...Typography.caption,
    color: Palette.text,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 10,
  },
  // Recent episodes list
  episodeListCard: {},
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  episodeRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  episodeRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  episodeRowHospital: {
    ...Typography.body,
    color: Palette.text,
    fontWeight: "600",
    fontSize: 13,
  },
  episodeRowDoctor: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  episodeRowDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  episodeRowRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginHorizontal: Spacing.md,
  },
  // Access history
  accessCard: {},
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  accessRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.info + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  accessRowRole: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.text,
    fontWeight: "600",
  },
  accessRowScope: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  accessRowDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    textAlign: "right",
  },
  noAccessNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Palette.success + "10",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.success + "30",
  },
  noAccessText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  // Share modal
  modalSafe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalClose: {
    padding: Spacing.xs,
  },
  shareCard: {
    marginBottom: Spacing.sm,
  },
  shareCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  shareRecipient: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  shareScope: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  shareExpiry: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  revokeBtn: {
    backgroundColor: Palette.error + "15",
    borderWidth: 1,
    borderColor: Palette.error,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  revokeBtnText: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "600",
  },
});
