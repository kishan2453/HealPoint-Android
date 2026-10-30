/**
 * Formats a doctor's name cleanly, ensuring exactly one "Dr." prefix
 * and preventing duplicate titles like "Dr. Dr. Anvi Kulkarni".
 *
 * @param {string} name - Raw doctor name
 * @param {string} [fallback="Doctor"] - Fallback if name is empty
 * @returns {string} Formatted name e.g. "Dr. Anvi Kulkarni"
 */
export const formatDoctorName = (name, fallback = "Doctor") => {
  if (!name) {
    if (!fallback) return "";
    return fallback.startsWith("Dr.") ? fallback : `Dr. ${fallback}`;
  }
  const clean = String(name)
    .replace(/^(?:(?:dr\.?|doctor)\s+)+/gi, "")
    .trim();
  return `Dr. ${clean || fallback}`;
};

/**
 * Strips any "Dr." or "Doctor" prefix to return the raw physician name.
 *
 * @param {string} name
 * @param {string} [fallback=""]
 * @returns {string}
 */
export const stripDoctorPrefix = (name, fallback = "") => {
  if (!name) return fallback;
  return (
    String(name)
      .replace(/^(?:(?:dr\.?|doctor)\s+)+/gi, "")
      .trim() || fallback
  );
};

export default formatDoctorName;
