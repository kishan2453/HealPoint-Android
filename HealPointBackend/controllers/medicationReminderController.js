import mongoose from "mongoose";
import medicationReminderModel from "../models/medicationReminderModel.js";
import appointmentModel from "../models/appointmentModel.js";
import prescriptionModel from "../models/prescriptionModel.js";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 1. Get Patient Medication Reminders, Today's Schedule & Adherence
 */
export const getPatientMedicationReminders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { familyMemberId, status, date } = req.query;

    const query = { userId };
    if (familyMemberId && familyMemberId !== "all") {
      query.familyMemberId = familyMemberId;
    }
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    const reminders = await medicationReminderModel
      .find(query)
      .populate("doctorId", "name speciality qualification degree hospitalName image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: -1 });

    const targetDate = date || getTodayDateString();

    // Build today's dose schedule by combining reminder times and logs
    const todaySchedule = [];
    let takenCount = 0;
    let missedCount = 0;
    let totalDoses = 0;

    for (const r of reminders) {
      if (!r.isActive) continue;

      const times = Array.isArray(r.times) && r.times.length ? r.times : ["08:00 AM"];

      for (const time of times) {
        totalDoses += 1;
        const existingLog = (r.logs || []).find(
          (l) => l.doseDate === targetDate && l.scheduledTime === time
        );

        const doseStatus = existingLog ? existingLog.status : "pending";
        if (doseStatus === "taken") takenCount += 1;
        if (doseStatus === "missed") missedCount += 1;

        todaySchedule.push({
          doseId: `${r._id}_${targetDate}_${time.replace(/[^a-zA-Z0-9]/g, "")}`,
          reminderId: r._id,
          medicineName: r.medicineName,
          strength: r.strength,
          dosage: r.dosage,
          timing: r.timing,
          scheduledTime: time,
          status: doseStatus,
          actionTimestamp: existingLog?.actionTimestamp || null,
          doctorName: r.doctorId?.name || "Attending Doctor",
          hospitalName: r.hospitalId?.name || "HealPoint Partner Hospital",
          instructions: r.instructions,
          familyMemberId: r.familyMemberId,
        });
      }
    }

    // Sort today's schedule chronologically by time
    todaySchedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    const adherenceRate =
      totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 100;

    // Fetch active prescriptions with medicines for auto-reminder shortcuts
    const activePrescriptions = await prescriptionModel
      .find({
        patientId: userId,
        status: { $in: ["issued", "amended"] },
      })
      .populate("doctorId", "name speciality")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      reminders,
      todaySchedule,
      activePrescriptions,
      summary: {
        totalReminders: reminders.length,
        activeReminders: reminders.filter((r) => r.isActive).length,
        todayTotalDoses: totalDoses,
        todayTakenDoses: takenCount,
        todayPendingDoses: totalDoses - takenCount - missedCount,
        adherenceRate,
      },
    });
  } catch (error) {
    console.error("[getPatientMedicationReminders Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Create Medication Reminder
 */
export const createMedicationReminder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const {
      medicineName,
      strength,
      dosage,
      frequency,
      timing,
      instructions,
      times,
      appointmentId,
      prescriptionId,
      doctorId,
      hospitalId,
      familyMemberId,
      refillReminder,
      followUpReminder,
      notificationPreferences,
    } = req.body;

    if (!medicineName || !medicineName.trim()) {
      return res.status(400).json({ success: false, message: "Medicine name is required" });
    }

    const scheduledTimes =
      Array.isArray(times) && times.length ? times : ["08:00 AM", "08:00 PM"];

    const reminder = new medicationReminderModel({
      userId,
      familyMemberId: familyMemberId || null,
      appointmentId: appointmentId || null,
      prescriptionId: prescriptionId || null,
      doctorId: doctorId || null,
      hospitalId: hospitalId || null,
      medicineName: medicineName.trim(),
      strength: strength || "",
      dosage: dosage || "1 Tablet",
      frequency: frequency || "1-0-1",
      timing: timing || "After food",
      instructions: instructions || "",
      times: scheduledTimes,
      isActive: true,
      refillReminder: refillReminder || { enabled: false },
      followUpReminder: followUpReminder || { enabled: false },
      notificationPreferences: notificationPreferences || {
        pushEnabled: true,
        sound: true,
        snoozeDurationMinutes: 15,
      },
    });

    await reminder.save();

    return res.status(201).json({
      success: true,
      message: "Medication reminder scheduled successfully",
      reminder,
    });
  } catch (error) {
    console.error("[createMedicationReminder Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Record Medication Dose Action (Taken, Skipped, Snoozed, Missed)
 */
export const recordMedicationAction = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { reminderId } = req.params;
    const { status, scheduledTime, date, notes } = req.body;

    const validStatuses = ["taken", "skipped", "snoozed", "missed", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid dose status. Allowed values: ${validStatuses.join(", ")}`,
      });
    }

    const reminder = await medicationReminderModel.findOne({
      _id: reminderId,
      userId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Medication reminder not found" });
    }

    const doseDate = date || getTodayDateString();
    const doseTime = scheduledTime || reminder.times[0] || "08:00 AM";

    // Update existing dose log or create new log
    const existingLogIndex = (reminder.logs || []).findIndex(
      (l) => l.doseDate === doseDate && l.scheduledTime === doseTime
    );

    if (existingLogIndex >= 0) {
      reminder.logs[existingLogIndex].status = status;
      reminder.logs[existingLogIndex].actionTimestamp = new Date();
      if (notes) reminder.logs[existingLogIndex].notes = notes;
    } else {
      reminder.logs.push({
        doseDate,
        scheduledTime: doseTime,
        status,
        actionTimestamp: new Date(),
        notes: notes || "",
      });
    }

    await reminder.save();

    return res.status(200).json({
      success: true,
      message: `Medication marked as ${status}`,
      reminder,
    });
  } catch (error) {
    console.error("[recordMedicationAction Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Update Reminder Preferences
 */
export const updateReminderPreferences = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { reminderId } = req.params;
    const { times, notificationPreferences, isActive, refillReminder, followUpReminder } = req.body;

    const reminder = await medicationReminderModel.findOne({
      _id: reminderId,
      userId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Medication reminder not found" });
    }

    if (Array.isArray(times) && times.length) reminder.times = times;
    if (notificationPreferences !== undefined) {
      reminder.notificationPreferences = {
        ...reminder.notificationPreferences,
        ...notificationPreferences,
      };
    }
    if (isActive !== undefined) reminder.isActive = Boolean(isActive);
    if (refillReminder !== undefined) {
      reminder.refillReminder = { ...reminder.refillReminder, ...refillReminder };
    }
    if (followUpReminder !== undefined) {
      reminder.followUpReminder = { ...reminder.followUpReminder, ...followUpReminder };
    }

    await reminder.save();

    return res.status(200).json({
      success: true,
      message: "Reminder preferences updated successfully",
      reminder,
    });
  } catch (error) {
    console.error("[updateReminderPreferences Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Delete or Deactivate Medication Reminder
 */
export const deleteMedicationReminder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { reminderId } = req.params;

    const reminder = await medicationReminderModel.findOne({
      _id: reminderId,
      userId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    // Safely deactivate rather than hard deleting to preserve adherence history
    reminder.isActive = false;
    await reminder.save();

    return res.status(200).json({
      success: true,
      message: "Medication reminder cancelled successfully",
    });
  } catch (error) {
    console.error("[deleteMedicationReminder Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Get Refill and Follow-up Reminders
 */
export const getRefillAndFollowUps = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const reminders = await medicationReminderModel
      .find({
        userId,
        isActive: true,
        $or: [{ "refillReminder.enabled": true }, { "followUpReminder.enabled": true }],
      })
      .populate("doctorId", "name speciality")
      .populate("hospitalId", "name phone");

    const upcomingRefills = [];
    const upcomingFollowUps = [];
    const now = new Date();

    for (const r of reminders) {
      if (r.refillReminder?.enabled && r.refillReminder?.refillDate) {
        upcomingRefills.push({
          reminderId: r._id,
          medicineName: r.medicineName,
          refillDate: r.refillReminder.refillDate,
          daysLeft: Math.ceil((new Date(r.refillReminder.refillDate) - now) / (1000 * 60 * 60 * 24)),
          doctor: r.doctorId,
          hospital: r.hospitalId,
        });
      }
      if (r.followUpReminder?.enabled && r.followUpReminder?.followUpDate) {
        upcomingFollowUps.push({
          reminderId: r._id,
          medicineName: r.medicineName,
          followUpDate: r.followUpReminder.followUpDate,
          daysLeft: Math.ceil((new Date(r.followUpReminder.followUpDate) - now) / (1000 * 60 * 60 * 24)),
          doctor: r.doctorId,
          hospital: r.hospitalId,
        });
      }
    }

    return res.status(200).json({
      success: true,
      upcomingRefills,
      upcomingFollowUps,
    });
  } catch (error) {
    console.error("[getRefillAndFollowUps Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
