import fs from "fs";

// --------------------------------------------------------------------------
// 1. Patch appointmentController.js
// --------------------------------------------------------------------------
let appt = fs.readFileSync("HealPointBackend/controllers/appointmentController.js", "utf8");

// Add dispatchNotification import if missing
if (!appt.includes("dispatchNotification")) {
  appt = appt.replace(
    'import { processAppointmentReminders } from "../services/reminderScheduler.js";',
    'import { processAppointmentReminders } from "../services/reminderScheduler.js";\nimport { dispatchNotification } from "../services/socketService.js";'
  );
}

// In bookAppointment
if (!appt.includes('title: "Appointment Booked"')) {
  const target = 'res.status(201).json({\n      success: true,\n      message: "Appointment booked successfully",';
  const targetCRLF = 'res.status(201).json({\r\n      success: true,\r\n      message: "Appointment booked successfully",';
  
  const notifCode = `    // Trigger real notifications to Patient, Doctor, and Hospital
    try {
      dispatchNotification({
        userId: req.user.id,
        recipientRole: "patient",
        title: "Appointment Booked",
        message: \`Your appointment with Dr. \${doctor.name} on \${slotDate} at \${slotTime} has been successfully placed.\`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        link: \`/appointment/\${newAppointment._id}\`,
        refId: newAppointment._id.toString(),
        refModel: "Appointment",
        meta: { appointmentId: newAppointment.appointmentId, doctorId: doctor._id.toString(), slotDate, slotTime },
      }).catch(() => {});

      dispatchNotification({
        doctorId: doctor._id,
        recipientRole: "doctor",
        title: "New Appointment Booked",
        message: \`\${finalPatientName} has booked an appointment for \${slotDate} at \${slotTime}.\`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        link: \`/doctor/appointments\`,
        refId: newAppointment._id.toString(),
        refModel: "Appointment",
        meta: { appointmentId: newAppointment.appointmentId, userId: req.user.id, slotDate, slotTime },
      }).catch(() => {});

      if (finalHospitalId) {
        dispatchNotification({
          hospitalId: finalHospitalId,
          recipientRole: "hospital_admin",
          title: "New OPD Booking",
          message: \`\${finalPatientName} booked with Dr. \${doctor.name} on \${slotDate} at \${slotTime}.\`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          link: \`/admin/appointments\`,
          refId: newAppointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

  if (appt.includes(targetCRLF)) {
    appt = appt.replace(targetCRLF, notifCode + targetCRLF);
    console.log("Patched bookAppointment (CRLF)");
  } else if (appt.includes(target)) {
    appt = appt.replace(target, notifCode + target);
    console.log("Patched bookAppointment (LF)");
  }
}

// In verifyAppointmentPayment
if (!appt.includes('title: "Payment Confirmed"')) {
  const payTarget = 'res.status(200).json({\n      success: true,\n      message: "Payment verified successfully",';
  const payTargetCRLF = 'res.status(200).json({\r\n      success: true,\r\n      message: "Payment verified successfully",';
  
  const payNotif = `    try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Payment Confirmed",
        message: \`Payment of ₹\${appointment.amount} for appointment #\${appointment.displayAppointmentId || appointment.appointmentId} was successful.\`,
        type: "payment",
        category: "payment",
        priority: "normal",
        link: \`/appointment/\${appointment._id}\`,
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.hospitalId) {
        dispatchNotification({
          hospitalId: appointment.hospitalId,
          recipientRole: "hospital_admin",
          title: "Payment Received",
          message: \`Payment of ₹\${appointment.amount} received for appointment #\${appointment.displayAppointmentId || appointment.appointmentId}.\`,
          type: "payment",
          category: "payment",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

  if (appt.includes(payTargetCRLF)) {
    appt = appt.replace(payTargetCRLF, payNotif + payTargetCRLF);
    console.log("Patched verifyAppointmentPayment (CRLF)");
  } else if (appt.includes(payTarget)) {
    appt = appt.replace(payTarget, payNotif + payTarget);
    console.log("Patched verifyAppointmentPayment (LF)");
  }
}

// In cancelAppointment
if (!appt.includes('title: "Appointment Cancelled"')) {
  const cancelTarget = 'res.status(200).json({\n      success: true,\n      message: "Appointment cancelled successfully",';
  const cancelTargetCRLF = 'res.status(200).json({\r\n      success: true,\r\n      message: "Appointment cancelled successfully",';

  const cancelNotif = `    try {
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
          message: \`Appointment on \${appointment.slotDate} at \${appointment.slotTime} was cancelled.\`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

  if (appt.includes(cancelTargetCRLF)) {
    appt = appt.replace(cancelTargetCRLF, cancelNotif + cancelTargetCRLF);
    console.log("Patched cancelAppointment (CRLF)");
  } else if (appt.includes(cancelTarget)) {
    appt = appt.replace(cancelTarget, cancelNotif + cancelTarget);
    console.log("Patched cancelAppointment (LF)");
  }
}

// In rescheduleAppointment
if (!appt.includes('title: "Appointment Rescheduled"')) {
  const reschedTarget = 'res.status(200).json({\n      success: true,\n      message: "Appointment rescheduled successfully",';
  const reschedTargetCRLF = 'res.status(200).json({\r\n      success: true,\r\n      message: "Appointment rescheduled successfully",';

  const reschedNotif = `    try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Appointment Rescheduled",
        message: \`Your appointment has been rescheduled to \${newSlotDate} at \${newSlotTime}.\`,
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
          message: \`Appointment for \${appointment.patientName} was rescheduled to \${newSlotDate} at \${newSlotTime}.\`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

  if (appt.includes(reschedTargetCRLF)) {
    appt = appt.replace(reschedTargetCRLF, reschedNotif + reschedTargetCRLF);
    console.log("Patched rescheduleAppointment (CRLF)");
  } else if (appt.includes(reschedTarget)) {
    appt = appt.replace(reschedTarget, reschedNotif + reschedTarget);
    console.log("Patched rescheduleAppointment (LF)");
  }
}

// In updateAppointmentStatus
if (!appt.includes('title: "Appointment Confirmed"')) {
  const statusTarget = 'res.status(200).json({\n      success: true,\n      message: "Appointment status updated",';
  const statusTargetCRLF = 'res.status(200).json({\r\n      success: true,\r\n      message: "Appointment status updated",';

  const statusNotif = `    try {
      if (appointment.userId) {
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
            ? \`Your consultation with Dr. \${doctor?.name || "Doctor"} has concluded.\`
            : status === "cancel"
            ? \`Your appointment on \${appointment.slotDate} at \${appointment.slotTime} was cancelled.\`
            : \`Your appointment status is now \${status}.\`;

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

  if (appt.includes(statusTargetCRLF)) {
    appt = appt.replace(statusTargetCRLF, statusNotif + statusTargetCRLF);
    console.log("Patched updateAppointmentStatus (CRLF)");
  } else if (appt.includes(statusTarget)) {
    appt = appt.replace(statusTarget, statusNotif + statusTarget);
    console.log("Patched updateAppointmentStatus (LF)");
  }
}

fs.writeFileSync("HealPointBackend/controllers/appointmentController.js", appt, "utf8");
console.log("Wrote updated appointmentController.js");

// --------------------------------------------------------------------------
// 2. Patch prescriptionController.js
// --------------------------------------------------------------------------
let presc = fs.readFileSync("HealPointBackend/controllers/prescriptionController.js", "utf8");
if (!presc.includes("dispatchNotification")) {
  presc = presc.replace(
    'import { generatePrescriptionPdfBuffer } from "../services/prescriptionPdfService.js";',
    'import { generatePrescriptionPdfBuffer } from "../services/prescriptionPdfService.js";\nimport { dispatchNotification } from "../services/socketService.js";'
  );
}

if (!presc.includes('title: "Digital Prescription Issued"')) {
  const prescTarget = 'return res.status(200).json({\n      success: true,\n      message: "Prescription officially issued and signed successfully",';
  const prescTargetCRLF = 'return res.status(200).json({\r\n      success: true,\r\n      message: "Prescription officially issued and signed successfully",';

  const prescNotif = `    try {
      dispatchNotification({
        userId: prescription.userId,
        recipientRole: "patient",
        title: "Digital Prescription Issued",
        message: \`Dr. \${prescription.doctorName} has issued your official digital prescription (\${prescription.medicines?.length || 0} medicines).\`,
        type: "prescription",
        category: "prescription",
        priority: "normal",
        link: \`/health/prescriptions\`,
        refId: prescription._id.toString(),
        refModel: "Prescription",
      }).catch(() => {});
    } catch (err) {}\n\n    `;

  if (presc.includes(prescTargetCRLF)) {
    presc = presc.replace(prescTargetCRLF, prescNotif + prescTargetCRLF);
    console.log("Patched issuePrescription (CRLF)");
  } else if (presc.includes(prescTarget)) {
    presc = presc.replace(prescTarget, prescNotif + prescTarget);
    console.log("Patched issuePrescription (LF)");
  }
}
fs.writeFileSync("HealPointBackend/controllers/prescriptionController.js", presc, "utf8");
console.log("Wrote updated prescriptionController.js");

// --------------------------------------------------------------------------
// 3. Patch checkInController.js
// --------------------------------------------------------------------------
let checkin = fs.readFileSync("HealPointBackend/controllers/checkInController.js", "utf8");
if (!checkin.includes("dispatchNotification")) {
  checkin = 'import { dispatchNotification } from "../services/socketService.js";\n' + checkin;
}

if (!checkin.includes('title: "Patient Checked In"')) {
  const checkinTarget = 'return res.status(200).json({\n      success: true,\n      message: "Check-in completed successfully",';
  const checkinTargetCRLF = 'return res.status(200).json({\r\n      success: true,\r\n      message: "Check-in completed successfully",';

  const checkinNotif = `    try {
      if (appointment.doctorId) {
        dispatchNotification({
          doctorId: appointment.doctorId,
          recipientRole: "doctor",
          title: "Patient Checked In",
          message: \`\${appointment.patientName} has checked in for OPD (Token #\${appointment.queueTokenNumber || "N/A"}).\`,
          type: "checkin",
          category: "checkin",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
      if (appointment.hospitalId) {
        dispatchNotification({
          hospitalId: appointment.hospitalId,
          recipientRole: "hospital_admin",
          title: "Patient OPD Check-In",
          message: \`\${appointment.patientName} verified check-in for Dr. \${appointment.doctorName || "Doctor"}.\`,
          type: "checkin",
          category: "checkin",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

  if (checkin.includes(checkinTargetCRLF)) {
    checkin = checkin.replace(checkinTargetCRLF, checkinNotif + checkinTargetCRLF);
    console.log("Patched processCheckIn (CRLF)");
  } else if (checkin.includes(checkinTarget)) {
    checkin = checkin.replace(checkinTarget, checkinNotif + checkinTarget);
    console.log("Patched processCheckIn (LF)");
  }
}
fs.writeFileSync("HealPointBackend/controllers/checkInController.js", checkin, "utf8");
console.log("Wrote updated checkInController.js");

