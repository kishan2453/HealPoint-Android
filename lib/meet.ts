import { Linking } from 'react-native';

/**
 * Safely open an external Google Meet URL. Only `https://meet.google.com/...`
 * links are accepted — nothing else. This mirrors the backend-side URL
 * validation so the app never opens an unexpected or empty destination.
 */
export function openGoogleMeetUrl(rawUrl?: string | null): boolean {
  const url = String(rawUrl || '').trim();
  if (!url) return false;
  if (!/^https:\/\/meet\.google\.com\/[a-z0-9][a-z0-9-]{2,}/i.test(url)) {
    return false;
  }
  try {
    Linking.openURL(url).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Human label for an appointment/consultation meeting status. */
export function meetingStatusLabel(status?: string): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'started':
      return 'Started';
    case 'completed':
      return 'Completed';
    default:
      return 'Not created';
  }
}

/** Human label for a consultation waiting-room status. */
export function consultationStatusLabel(status?: string): string {
  switch (status) {
    case 'doctor_ready':
      return 'Doctor is ready';
    case 'ready_to_join':
      return 'Ready to join';
    case 'in_progress':
      return 'Consultation in progress';
    case 'completed':
      return 'Completed';
    case 'unavailable':
      return 'Doctor unavailable';
    default:
      return 'Waiting for doctor';
  }
}