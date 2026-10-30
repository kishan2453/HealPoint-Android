import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import { sendAppointmentReminderEmail } from "./emailService.js";

/**
 * Parses appointment slotDate ("DD-MM-YYYY") and slotTime ("10:00 AM") into a Date object.
 */
export const parseAppointmentDateTime = (slotDateStr, slotTimeStr) => {
  if (!slotDateStr) return null;
  const parts = slotDateStr.split(/[-/]/);
  if (parts.length < 3) return null;

  let day, month, year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }

  let hours = 9;
  let minutes = 0;
  if (slotTimeStr) {
    const timeParts = slotTimeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeParts) {
      hours = parseInt(timeParts[1], 10);
      minutes = parseInt(timeParts[2], 10);
      const ampm = (timeParts[3] || "").toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
};

/**
 * Runs one check pass to send 24-hour and 1-hour email reminders for eligible upcoming appointments.
 */
export const processAppointmentReminders = async () => {
  const now = new Date();
  const results = {
    checked: 0,
    reminders24hSent: 0,
    reminders1hSent: 0,
    errors: [],
  };

  try {
    // Find upcoming appointments that are not cancelled or rejected
    const appointments = await appointmentModel.find({
      status: { $in: ["pending", "confirmed", "scheduled"] },
      paymentStatus: { $ne: "FAILED" },
      $or: [{ reminder24hSent: false }, { reminder1hSent: false }],
    });

    results.checked = appointments.length;

    for (const appt of appointments) {
      const apptDate = parseAppointmentDateTime(appt.slotDate, appt.slotTime);
      if (!apptDate || isNaN(apptDate.getTime())) continue;

      const diffMs = apptDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Skip past appointments
      if (diffHours < 0) continue;

      // 1. Check 24-Hour Reminder (Window: 23 to 25 hours before appointment)
      const isEligible24h = diffHours >= 23 && diffHours <= 25 && !appt.reminder24hSent;

      // 2. Check 1-Hour Reminder (Window: 0.5 to 1.5 hours before appointment)
      const isEligible1h = diffHours >= 0.5 && diffHours <= 1.5 && !appt.reminder1hSent;

      if (!isEligible24h && !isEligible1h) continue;

      // Load patient's registered user record to get verified email
      const user = await userModel.findById(appt.userId);
      const recipientEmail = user?.email;
      if (!recipientEmail || !recipientEmail.includes("@")) {
        console.warn(`[ReminderScheduler] No email found for patient user ID ${appt.userId}`);
        continue;
      }

      // Load doctor and hospital details for email formatting
      let doctorName = appt.doctorName || "Specialist";
      let hospitalName = appt.hospitalName || "HealPoint Hospital";

      if (appt.doctorId) {
        const doctor = await doctorModel.findById(appt.doctorId);
        if (doctor?.name) doctorName = doctor.name;
      }
      if (appt.hospitalId) {
        const hospital = await hospitalModel.findById(appt.hospitalId);
        if (hospital?.name) hospitalName = hospital.name;
      }

      // Dispatch 24-Hour Reminder
      if (isEligible24h) {
        try {
          const res = await sendAppointmentReminderEmail({
            to: recipientEmail,
            patientName: appt.patientName || user.name,
            doctorName,
            hospitalName,
            date: appt.slotDate,
            time: appt.slotTime,
            consultationType: appt.consultationType,
            reminderType: "24h",
            appointmentId: appt.appointmentId || appt._id,
            meetingUrl: appt.meetingUrl,
          });

          appt.reminder24hSent = true;
          appt.reminder24hSentAt = new Date();
          appt.reminderLogs = appt.reminderLogs || [];
          appt.reminderLogs.push({
            type: "24h",
            status: "sent",
            sentAt: new Date(),
            recipient: recipientEmail,
          });
          await appt.save();
          results.reminders24hSent++;
        } catch (err) {
          console.error(`[ReminderScheduler] Failed 24h reminder for ${appt._id}:`, err.message);
          appt.reminderLogs = appt.reminderLogs || [];
          appt.reminderLogs.push({
            type: "24h",
            status: "failed",
            sentAt: new Date(),
            recipient: recipientEmail,
            error: err.message,
          });
          await appt.save();
          results.errors.push({ appointmentId: appt._id, type: "24h", error: err.message });
        }
      }

      // Dispatch 1-Hour Reminder
      if (isEligible1h) {
        try {
          const res = await sendAppointmentReminderEmail({
            to: recipientEmail,
            patientName: appt.patientName || user.name,
            doctorName,
            hospitalName,
            date: appt.slotDate,
            time: appt.slotTime,
            consultationType: appt.consultationType,
            reminderType: "1h",
            appointmentId: appt.appointmentId || appt._id,
            meetingUrl: appt.meetingUrl,
          });

          appt.reminder1hSent = true;
          appt.reminder1hSentAt = new Date();
          appt.reminderLogs = appt.reminderLogs || [];
          appt.reminderLogs.push({
            type: "1h",
            status: "sent",
            sentAt: new Date(),
            recipient: recipientEmail,
          });
          await appt.save();
          results.reminders1hSent++;
        } catch (err) {
          console.error(`[ReminderScheduler] Failed 1h reminder for ${appt._id}:`, err.message);
          appt.reminderLogs = appt.reminderLogs || [];
          appt.reminderLogs.push({
            type: "1h",
            status: "failed",
            sentAt: new Date(),
            recipient: recipientEmail,
            error: err.message,
          });
          await appt.save();
          results.errors.push({ appointmentId: appt._id, type: "1h", error: err.message });
        }
      }
    }
  } catch (err) {
    console.error("[ReminderScheduler] Error running reminder pass:", err);
  }

  return results;
};

let schedulerInterval = null;

export const startReminderScheduler = (intervalMinutes = 5) => {
  if (schedulerInterval) return;
  console.log(`[ReminderScheduler] Initialized background appointment reminder scheduler (every ${intervalMinutes}m)`);
  schedulerInterval = setInterval(() => {
    processAppointmentReminders().catch((err) => {
      console.error("[ReminderScheduler] Error in interval execution:", err);
    });
  }, intervalMinutes * 60 * 1000);
};

export const stopReminderScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};

