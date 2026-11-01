import fs from "fs";

let appt = fs.readFileSync("HealPointBackend/controllers/appointmentController.js", "utf8");

// Cancel notification
const cancelMatch = 'res.status(200).json({ success: true, message: "Appointment cancelled successfully", appointment });';
if (appt.includes(cancelMatch) && !appt.includes('title: "Appointment Cancelled"')) {
  const cancelCode = `try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Appointment Cancelled",
        message: \`Appointment #\${appointment.displayAppointmentId || appointment.appointmentId} has been cancelled.\`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.doctorId) {
        dispatchNotification({
          doctorId: appointment.doctorId,
          recipientRole: "doctor",
          title: "Appointment Cancelled",
          message: \`Appointment for \${appointment.patientName} on \${appointment.slotDate} at \${appointment.slotTime} was cancelled.\`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;
  appt = appt.replace(cancelMatch, cancelCode + cancelMatch);
  console.log("Patched cancelAppointment successfully");
}

// Reschedule notification
const reschedMatch = 'res.status(200).json({ success: true, message: "Appointment rescheduled successfully", appointment });';
if (appt.includes(reschedMatch) && !appt.includes('title: "Appointment Rescheduled"')) {
  const reschedCode = `try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Appointment Rescheduled",
        message: \`Your appointment has been rescheduled to \${slotDate} at \${slotTime}.\`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.doctorId) {
        dispatchNotification({
          doctorId: appointment.doctorId,
          recipientRole: "doctor",
          title: "Appointment Rescheduled",
          message: \`Appointment for \${appointment.patientName} was rescheduled to \${slotDate} at \${slotTime}.\`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;
  appt = appt.replace(reschedMatch, reschedCode + reschedMatch);
  console.log("Patched rescheduleAppointment successfully");
}

// Status update notification
const statusMatch = 'res.status(200).json({ success: true, message: "Appointment updated successfully", appointment });';
if (appt.includes(statusMatch) && !appt.includes('title: "Appointment Status Updated"')) {
  const statusCode = `try {
      if (appointment.userId && status) {
        const statusTitle =
          status === "confirmed"
            ? "Appointment Confirmed"
            : status === "completed"
            ? "Consultation Completed"
            : status === "cancel"
            ? "Appointment Cancelled by Clinic"
            : "Appointment Status Updated";

        const statusMsg =
          status === "confirmed"
            ? \`Your appointment on \${appointment.slotDate} at \${appointment.slotTime} has been confirmed.\`
            : status === "completed"
            ? \`Your consultation has concluded successfully.\`
            : status === "cancel"
            ? \`Your appointment on \${appointment.slotDate} at \${appointment.slotTime} was cancelled.\`
            : \`Your appointment status has changed to \${status}.\`;

        dispatchNotification({
          userId: appointment.userId,
          recipientRole: "patient",
          title: statusTitle,
          message: statusMsg,
          type: "appointment",
          category: "appointment",
          priority: status === "cancel" ? "high" : "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;
  appt = appt.replace(statusMatch, statusCode + statusMatch);
  console.log("Patched updateAppointmentStatus successfully");
}

fs.writeFileSync("HealPointBackend/controllers/appointmentController.js", appt, "utf8");
console.log("All appointment triggers patched successfully!");

