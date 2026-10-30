/**
 * HealPoint - client-side validation helpers.
 *
 * Password/phone rules mirror the backend so the user gets the same message
 * the server would return, reducing failed requests.
 */

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_HELP =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
/**
 * Balanced email rule: accepts real-world addresses (including `+` tags and the
 * `.test` development domain) while rejecting the genuinely broken formats:
 *   - `doctor@`            → missing domain
 *   - `@example.com`       → missing local part
 *   - `doctor@@example.com`→ duplicated `@` (the old loose `\S+@\S+\.\S+`
 *                            silently accepted this)
 *   - `a b@example.com`    → whitespace inside the address
 *   - `doctor@example.c`   → 1-letter TLD
 * The 2+ letter alphabetic TLD keeps it aligned with the HTML5 email input and
 * common validator libraries without being unnecessarily strict.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export function normalizeEmail(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 5 || trimmed.length > 254) return false;
  if (trimmed.includes("..") || trimmed.includes("@.")) return false;
  return EMAIL_REGEX.test(trimmed);
}

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  missingRequirements: string[];
  errorMessage?: string;
}

export function getPasswordValidation(value: string): PasswordValidationResult {
  const pwd = typeof value === "string" ? value : "";
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  const missing: string[] = [];
  if (!hasMinLength) missing.push("at least 8 characters");
  if (!hasUppercase) missing.push("an uppercase letter (A-Z)");
  if (!hasLowercase) missing.push("a lowercase letter (a-z)");
  if (!hasNumber) missing.push("a number (0-9)");
  if (!hasSpecial) missing.push("a special character (!@#$%^&*)");

  const isValid = missing.length === 0;

  return {
    isValid,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    missingRequirements: missing,
    errorMessage: isValid
      ? undefined
      : `Password requires ${missing.join(", ")}.`,
  };
}

export function isValidStrongPassword(value: string): boolean {
  if (typeof value !== "string") return false;
  return STRONG_PASSWORD_REGEX.test(value);
}

/** Backend expects a 10-digit Indian mobile starting with 6, 7, 8 or 9. */
export function isValidIndianPhone(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/\s+/g, ""));
}

export function isNonEmpty(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export interface AdultDobValidationResult {
  isValid: boolean;
  error?: string;
  age?: number;
}

/**
 * Strict 18+ Date of Birth validation for HealPoint accounts.
 * Calculates age exactly using year, month, and day against the current date.
 * Rejects:
 *  - Empty or non-string inputs
 *  - Malformed date strings
 *  - Impossible calendar dates (e.g. Feb 31)
 *  - Future dates
 *  - Under-18 users (< 18 full solar years) with exact prompt message
 */
export function validateAdultDob(
  dobStr: string | undefined | null,
): AdultDobValidationResult {
  if (!dobStr || typeof dobStr !== "string" || !dobStr.trim()) {
    return { isValid: false, error: "Date of birth is required." };
  }
  const trimmed = dobStr.trim();
  let year: number;
  let month: number;
  let day: number;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  } else {
    return {
      isValid: false,
      error: "Please enter a valid date of birth (DD-MM-YYYY or YYYY-MM-DD).",
    };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { isValid: false, error: "Please enter a valid calendar date." };
  }

  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return { isValid: false, error: "Please enter a valid calendar date." };
  }

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-12
  const todayDay = today.getDate();

  if (
    birthDate.getTime() > today.getTime() ||
    year > todayYear ||
    (year === todayYear &&
      (month > todayMonth || (month === todayMonth && day > todayDay)))
  ) {
    return { isValid: false, error: "Date of birth cannot be in the future." };
  }

  // Calculate age precisely by year, month, and day
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) {
    age--;
  }

  if (age < 18) {
    return {
      isValid: false,
      error: "You must be at least 18 years old to create an account.",
      age,
    };
  }

  if (age > 125) {
    return { isValid: false, error: "Please enter a valid date of birth." };
  }

  return { isValid: true, age };
}
