package com.healpoint.app.util

/**
 * Client-side validation. Mirrors the rules enforced by the backend so the
 * user sees the same messages the server would return.
 */
object Validation {

    /**
     * Balanced email rule: accepts real-world addresses (including `+` tags and
     * the `.test` development domain) while rejecting genuinely broken formats
     * (`doctor@`, `@example.com`, `doctor@@example.com`, whitespace inside, and
     * 1-letter TLDs). Mirrors `lib/validation.ts` in the Expo client.
     */
    private val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
    private val PHONE_REGEX = Regex("^[6-9]\\d{9}$")

    fun isValidEmail(value: String): Boolean = EMAIL_REGEX.matches(value.trim())

    fun isValidStrongPassword(value: String): Boolean {
        val v = value
        return v.length >= 8 &&
            v.any { it.isLowerCase() } &&
            v.any { it.isUpperCase() } &&
            v.any { it.isDigit() } &&
            v.any { !it.isLetterOrDigit() }
    }

    const val PASSWORD_HELP =
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."

    /** Backend expects a 10-digit Indian mobile starting with 6, 7, 8 or 9. */
    fun isValidIndianPhone(value: String): Boolean =
        PHONE_REGEX.matches(value.replace(Regex("\\s+"), ""))

    fun isNonEmpty(value: String?): Boolean = value?.trim()?.isNotEmpty() == true
}
