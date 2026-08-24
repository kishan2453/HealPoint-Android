package com.healpoint.app.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val DATE_DD_MM_YYYY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")
private val MONTHS_SHORT = arrayOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)

fun LocalDate.toDDMMYYYY(): String = format(DATE_DD_MM_YYYY)

fun parseDDMMYYYY(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try {
        LocalDate.parse(value.trim(), DATE_DD_MM_YYYY)
    } catch (_: Exception) {
        null
    }
}

/** `19 Aug 2026` style display from a `DD-MM-YYYY` string. */
fun displayDate(value: String?): String {
    val date = parseDDMMYYYY(value) ?: return value ?: "-"
    return "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]} ${date.year}"
}

/** `24 Aug` style label for the date picker row. */
fun dateLabel(date: LocalDate): String =
    "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]}"

fun weekdayLabel(date: LocalDate): String {
    val names = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
    return names[date.dayOfWeek.value % 7]
}

/** Indian (en-IN) style thousands grouping. */
fun formatINR(amount: Int?): String {
    val value = amount ?: 0
    if (value < 0) return "₹${value}"
    val s = value.toString()
    if (s.length <= 3) return "₹$s"
    val last3 = s.takeLast(3)
    val rest = s.dropLast(3)
    val grouped = rest.reversed().chunked(2).joinToString(",").reversed()
    return "₹$grouped,$last3"
}

fun Float.formatRating(): String = String.format("%.1f", this)

fun String.firstName(): String = trim().split(Regex("\\s+")).firstOrNull().orEmpty()
