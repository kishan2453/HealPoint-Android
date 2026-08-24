/**
 * HealPoint - Razorpay Checkout bridge.
 *
 * Wraps the native `RNRazorpayCheckout` module (shipped by the official
 * `react-native-razorpay` package) behind a small, typed, promise-based API.
 *
 * Why we do not call `react-native-razorpay`'s JS wrapper directly:
 *   * It resolves a second TurboModule (`RazorpayEventEmitter`) that the
 *     package does not actually register a native implementation for, which
 *     throws on the New Architecture.
 *   * The native module already emits events on the *global*
 *     `DeviceEventEmitter` (`Razorpay::PAYMENT_SUCCESS` / `PAYMENT_ERROR`),
 *     so we bridge straight to the TurboModule and wait for those events.
 *
 * Security contract:
 *   * Only the Razorpay Key ID (public) and the backend-created order are
 *     passed to checkout. The Key Secret lives exclusively on the backend and
 *     is never part of this bundle.
 *   * A successful mobile callback is NOT trusted on its own - the caller must
 *     still call `verifyAppointmentPayment()` so the backend can validate the
 *     signature before anything is marked paid.
 */
import { DeviceEventEmitter, NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import type { TurboModule } from 'react-native';

import type {
  RazorpayCheckoutOptions,
  RazorpayNativeModule,
  RazorpayPaymentError,
  RazorpayPaymentResponse,
} from '@/types/razorpay';

const SUCCESS_EVENT = 'Razorpay::PAYMENT_SUCCESS';
const ERROR_EVENT = 'Razorpay::PAYMENT_ERROR';

/** Razorpay fires these codes for a user-cancelled payment. */
const CANCELLED_CODES = new Set<number>([2, 26]);

/** If checkout never resolves (e.g. activity lost), fail instead of spinning forever. */
const CHECKOUT_TIMEOUT_MS = 90_000;

interface RazorpayTurboModule extends TurboModule {
  open(options: object): void;
}

/**
 * Locate the native module. In a development/standalone build it is available;
 * in Expo Go (no dev client) it is not, and we return `null` so the caller can
 * show an honest, actionable message instead of a fake success.
 */
function resolveNativeModule(): RazorpayNativeModule | null {
  try {
    const turbo = TurboModuleRegistry.get<RazorpayTurboModule>('RNRazorpayCheckout');
    if (turbo && typeof turbo.open === 'function') {
      return turbo as unknown as RazorpayNativeModule;
    }
  } catch {
    // fall through to NativeModules
  }
  const legacy = (NativeModules as unknown as { RNRazorpayCheckout?: RazorpayNativeModule })
    .RNRazorpayCheckout;
  if (legacy && typeof legacy.open === 'function') {
    return legacy;
  }
  return null;
}

/** True when this platform can render the native Razorpay Checkout. */
export function isRazorpayCheckoutAvailable(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
  return resolveNativeModule() !== null;
}

function normalizeError(raw: unknown): RazorpayPaymentError {
  if (raw && typeof raw === 'object') {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.code === 'number' && typeof candidate.description === 'string') {
      return candidate as unknown as RazorpayPaymentError;
    }
  }
  const message = raw instanceof Error ? raw.message : 'Unable to start the payment. Please try again.';
  return { code: 0, description: message, source: 'sdk', step: 'checkout', reason: 'unknown', metadata: {} };
}

function logPaymentError(error: RazorpayPaymentError) {
  if (!__DEV__) return;
  console.warn('[razorpay] checkout failed', {
    code: error.code,
    description: error.description,
    reason: error.reason,
    source: error.source,
    step: error.step,
    metadata: error.metadata,
  });
}

/**
 * Open the Razorpay Checkout for the given options.
 *
 * Resolves with `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }`
 * on success and rejects with a `RazorpayPaymentError` on failure/cancellation.
 * Rejects if the native module is unavailable (e.g. Expo Go or an unsupported
 * platform), if the order creation already failed, or on timeout.
 */
export function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpayPaymentResponse> {
  const module = resolveNativeModule();
  if (!module) {
    return Promise.reject(
      new Error(
        Platform.OS === 'web'
          ? 'Online payment is not available in the web app yet.'
          : 'Razorpay is not available in this build. Please use a development build or the installed app.',
      ),
    );
  }

  return new Promise<RazorpayPaymentResponse>((resolve, reject) => {
    let settled = false;

    const successSubscription = DeviceEventEmitter.addListener(SUCCESS_EVENT, (data: unknown) => {
      cleanup();
      try {
        const payload = (data ?? {}) as Record<string, unknown>;
        const paymentId = String(payload.razorpay_payment_id || '');
        if (!paymentId) {
          reject(
            normalizeError({
              code: 0,
              description: 'The payment result was empty. Returning you to retry.',
              source: 'sdk',
              step: 'callback',
            }),
          );
          return;
        }
        resolve({
          razorpay_payment_id: paymentId,
          razorpay_order_id: payload.razorpay_order_id ? String(payload.razorpay_order_id) : undefined,
          razorpay_signature: payload.razorpay_signature ? String(payload.razorpay_signature) : undefined,
        });
      } catch (error) {
        reject(normalizeError(error));
      }
    });

    const errorSubscription = DeviceEventEmitter.addListener(ERROR_EVENT, (data: unknown) => {
      cleanup();
      const error = normalizeError(data);
      logPaymentError(error);
      reject(error);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'The payment is taking too long to complete. Please check your connection and try again.',
        ),
      );
    }, CHECKOUT_TIMEOUT_MS);

    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      successSubscription?.remove();
      errorSubscription?.remove();
    }

    try {
      module.open(options);
    } catch (error) {
      cleanup();
      const paymentError = normalizeError(error);
      logPaymentError(paymentError);
      reject(paymentError);
    }
  });
}

/** True when a thrown `RazorpayPaymentError` represents a user cancel. */
export function isPaymentCancelled(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return CANCELLED_CODES.has(Number((error as { code: number }).code));
  }
  return false;
}
