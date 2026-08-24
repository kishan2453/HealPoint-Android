/**
 * HealPoint - client-side validation helpers.
 *
 * Password/phone rules mirror the backend so the user gets the same message
 * the server would return, reducing failed requests.
 */

export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_HELP =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidStrongPassword(value: string): boolean {
  return STRONG_PASSWORD_REGEX.test(value);
}

/** Backend expects a 10-digit Indian mobile starting with 6, 7, 8 or 9. */
export function isValidIndianPhone(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/\s+/g, ''));
}

export function isNonEmpty(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}