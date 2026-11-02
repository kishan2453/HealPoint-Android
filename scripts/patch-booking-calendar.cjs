const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'booking', '[doctorId].tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix header duplicate title & overlapping subtitle
const oldHeaderPattern = `<View style={styles.headerTitles}>\\s*<Text style={styles.headerTitle}>Book Appointment</Text>\\s*<Text style={styles.headerTitle}>\\s*\\{source === "rebook" \\? "Repeat Consultation" : "Book Appointment"\\}\\s*</Text>\\s*<Text style={styles.headerSubtitle}>\\s*Reserve your visit with \\{stripDoctorTitle\\(doctor\\.name\\)\\}\\s*\\{source === "rebook"\\s*\\? \`Re-booking care with \\$\\{stripDoctorTitle\\(doctor\\.name\\)\\}\`\\s*: \`Reserve your visit with \\$\\{stripDoctorTitle\\(doctor\\.name\\)\\}\`\\}\\s*</Text>\\s*</View>`;

const newHeader = `<View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>
              {source === "rebook" ? "Repeat Consultation" : "Book Appointment"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {source === "rebook"
                ? \`Re-booking care with \${stripDoctorTitle(doctor.name)}\`
                : \`Reserve your visit with \${stripDoctorTitle(doctor.name)}\`}
            </Text>
          </View>`;

content = content.replace(new RegExp(oldHeaderPattern), newHeader);

// 2. Add state hooks for Full Calendar
const stateTarget = `const [selectedDate, setSelectedDate] = useState<Date>(new Date());`;
const stateReplacement = `const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFullCalendar, setShowFullCalendar] = useState<boolean>(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const matrix: Array<{ day: number; date: Date | null }> = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      matrix.push({ day: 0, date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      matrix.push({ day: d, date });
    }
    return matrix;
  }, [calendarViewDate]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      calendarViewDate.getFullYear() === now.getFullYear() &&
      calendarViewDate.getMonth() === now.getMonth()
    );
  }, [calendarViewDate]);

  const handlePrevMonth = () => {
    if (isCurrentMonth) return;
    setCalendarViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCalendarViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const isDateInPast = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < today;
  };`;

content = content.replace(stateTarget, stateReplacement);

// 3. Add full calendar view inside Step 1 (Select Date)
const step1ScrollViewEnd = `          </ScrollView>
        </Card>`;

const step1WithCalendar = `          </ScrollView>

          {/* Full Calendar View Toggle & Grid */}
          <View style={styles.calendarToggleContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showFullCalendar ? "Collapse Full Calendar" : "View Full Calendar"}
              onPress={() => setShowFullCalendar((prev) => !prev)}
              style={({ pressed }) => [
                styles.calendarToggleBtn,
                showFullCalendar && styles.calendarToggleBtnActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={showFullCalendar ? Palette.white : Palette.primary}
              />
              <Text
                style={[
                  styles.calendarToggleText,
                  showFullCalendar && styles.calendarToggleTextActive,
                ]}
              >
                {showFullCalendar ? "Hide Full Calendar" : "View Full Calendar"}
              </Text>
              <Ionicons
                name={showFullCalendar ? "chevron-up" : "chevron-down"}
                size={16}
                color={showFullCalendar ? Palette.white : Palette.primary}
              />
            </Pressable>
            {selectedDateStr ? (
              <Text style={styles.calendarSelectedHint}>
                Selected: <Text style={{ fontWeight: "700", color: Palette.primary }}>{formatDDMMYYYY(selectedDateStr)}</Text>
              </Text>
            ) : null}
          </View>

          {showFullCalendar ? (
            <View style={styles.fullCalendarBox}>
              <View style={styles.calHeaderRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous Month"
                  onPress={handlePrevMonth}
                  disabled={isCurrentMonth}
                  style={({ pressed }) => [
                    styles.calNavBtn,
                    isCurrentMonth && styles.calNavBtnDisabled,
                    pressed && !isCurrentMonth && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={isCurrentMonth ? Palette.border : Palette.text}
                  />
                </Pressable>
                <Text style={styles.calMonthTitle}>
                  {calendarViewDate.toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next Month"
                  onPress={handleNextMonth}
                  style={({ pressed }) => [
                    styles.calNavBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Palette.text}
                  />
                </Pressable>
              </View>

              <View style={styles.calWeekdaysRow}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
                  <Text key={dayName} style={styles.calWeekdayText}>
                    {dayName}
                  </Text>
                ))}
              </View>

              <View style={styles.calDaysGrid}>
                {calendarDays.map((cell, idx) => {
                  if (!cell.date) {
                    return (
                      <View
                        key={\`blank-\${idx}\`}
                        style={styles.calDayCellEmpty}
                      />
                    );
                  }
                  const cellDateStr = toDDMMYYYY(cell.date);
                  const isSelected = cellDateStr === selectedDateStr;
                  const isPast = isDateInPast(cell.date);
                  const isOnLeave = Boolean(
                    doctor?.leaveDates?.includes(cellDateStr),
                  );
                  const isToday = cellDateStr === toDDMMYYYY(new Date());

                  return (
                    <Pressable
                      key={cellDateStr}
                      disabled={isPast || isOnLeave}
                      onPress={() => setSelectedDate(cell.date!)}
                      style={({ pressed }) => [
                        styles.calDayCell,
                        isSelected && styles.calDayCellSelected,
                        isPast && styles.calDayCellDisabled,
                        isOnLeave && styles.calDayCellLeave,
                        isToday && !isSelected && styles.calDayCellToday,
                        pressed && !isPast && !isOnLeave && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayNumber,
                          isSelected && styles.calDayNumberSelected,
                          isPast && styles.calDayNumberDisabled,
                          isOnLeave && styles.calDayNumberLeave,
                          isToday && !isSelected && styles.calDayNumberToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {isOnLeave ? <View style={styles.calLeaveDot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>`;

content = content.replace(step1ScrollViewEnd, step1WithCalendar);

// 4. Append styles for Full Calendar
const styleTarget = `  dateWeekday: {`;
const newStyles = `  calendarToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  calendarToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  calendarToggleBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  calendarToggleText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  calendarToggleTextActive: {
    color: Palette.white,
  },
  calendarSelectedHint: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  fullCalendarBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  calHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  calNavBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
  },
  calNavBtnDisabled: {
    opacity: 0.3,
  },
  calMonthTitle: {
    ...Typography.label,
    color: Palette.text,
    fontWeight: "700",
  },
  calWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    marginBottom: 4,
  },
  calWeekdayText: {
    ...Typography.caption,
    color: Palette.textMuted,
    width: 38,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 11,
  },
  calDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calDayCellEmpty: {
    width: "14.28%",
    height: 38,
  },
  calDayCell: {
    width: "14.28%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    marginVertical: 2,
    position: "relative",
  },
  calDayCellSelected: {
    backgroundColor: Palette.primary,
  },
  calDayCellDisabled: {
    opacity: 0.3,
  },
  calDayCellLeave: {
    backgroundColor: "rgba(232, 154, 60, 0.15)",
  },
  calDayCellToday: {
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  calDayNumber: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  calDayNumberSelected: {
    color: Palette.white,
    fontWeight: "800",
  },
  calDayNumberDisabled: {
    color: Palette.textMuted,
  },
  calDayNumberLeave: {
    color: Palette.warning,
  },
  calDayNumberToday: {
    color: Palette.primary,
    fontWeight: "700",
  },
  calLeaveDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.warning,
  },
  dateWeekday: {`;

content = content.replace(styleTarget, newStyles);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched booking calendar and fixed header in app/booking/[doctorId].tsx');
