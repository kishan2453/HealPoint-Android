import fs from "fs";
import path from "path";

// 1. Patch appointmentController.js
const controllerPath = path.resolve("HealPointBackend/controllers/appointmentController.js");
let controllerCode = fs.readFileSync(controllerPath, "utf8");

if (!controllerCode.includes("export const getPatientFollowUps =")) {
  const followUpFn = `

/**
 * Get Patient Follow-Ups & Care Continuity Overview
 * GET /api/v1/appointment/patient/follow-ups
 */
export const getPatientFollowUps = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await userModel.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { familyMemberId, status, search } = req.query;

    const query = {
      $or: [{ userId: user._id }, { patientId: user._id }],
    };

    if (familyMemberId && familyMemberId !== "all") {
      if (mongoose.Types.ObjectId.isValid(familyMemberId)) {
        query.familyMemberId = new mongoose.Types.ObjectId(familyMemberId);
      } else {
        query.familyMemberId = familyMemberId;
      }
    }

    const appointments = await appointmentModel
      .find(query)
      .populate("doctorId", "name speciality image qualification phone hospitalName fees")
      .populate("hospitalId", "name location contact logo")
      .sort({ createdAt: -1 })
      .lean();

    let followUps = appointments
      .filter((appt) => appt.status === "completed" || appt.followUpAdvice || appt.status === "confirmed")
      .map((appt) => {
        const doc = appt.doctorId || {};
        const hosp = appt.hospitalId || {};

        let followUpStatus = "pending_booking";
        if (appt.status === "completed") {
          followUpStatus = "pending_booking";
        } else if (appt.status === "confirmed") {
          followUpStatus = "scheduled";
        }

        const hasPrescription = Boolean(appt.prescription || (appt.medicines && appt.medicines.length > 0));
        const hasReports = Boolean(appt.medicalReports && appt.medicalReports.length > 0);

        return {
          _id: appt._id.toString(),
          appointmentId: appt._id.toString(),
          displayAppointmentId:
            appt.displayAppointmentId ||
            appt.appointmentId ||
            \`APT-\${appt._id.toString().slice(-6).toUpperCase()}\`,
          patientName: appt.patientName || user.name,
          patientPhone: appt.patientPhone || user.phone,
          familyMemberId: appt.familyMemberId?.toString() || null,
          familyRelationship: appt.familyRelationship || "Self",
          doctorId: doc._id?.toString() || appt.doctorId?.toString(),
          doctorName: doc.name || "Doctor",
          doctorSpecialty: doc.speciality || "Specialist",
          doctorImage: doc.image || "",
          hospitalId: hosp._id?.toString() || appt.hospitalId?.toString(),
          hospitalName: hosp.name || appt.hospitalName || "HealPoint Hospital",
          consultationDate: appt.slotDate,
          consultationTime: appt.slotTime,
          consultationType: appt.consultationType || "clinic",
          consultationStatus: appt.consultationStatus || "completed",
          status: followUpStatus,
          diagnosis: appt.diagnosis || "Clinical Consultation",
          advice:
            appt.followUpAdvice ||
            appt.medicalNotes ||
            "Continue prescribed regimen and schedule follow-up if symptoms persist.",
          recommendedFollowUpDate: appt.slotDate,
          hasPrescription,
          hasReports,
          reportStatus: hasReports ? "available" : "none",
          medicines: appt.medicines || [],
          isEligibleForRebook: true,
        };
      });

    if (status && status !== "all") {
      followUps = followUps.filter((f) => f.status === status);
    }

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      followUps = followUps.filter(
        (f) =>
          f.doctorName?.toLowerCase().includes(q) ||
          f.doctorSpecialty?.toLowerCase().includes(q) ||
          f.diagnosis?.toLowerCase().includes(q) ||
          f.hospitalName?.toLowerCase().includes(q)
      );
    }

    const total = followUps.length;
    const pendingBooking = followUps.filter((f) => f.status === "pending_booking").length;
    const scheduled = followUps.filter((f) => f.status === "scheduled").length;
    const completed = followUps.filter((f) => f.status === "completed").length;

    const latestCompleted = appointments.find((a) => a.status === "completed") || appointments[0] || null;
    let latestCompletedConsultation = null;
    if (latestCompleted) {
      const lDoc = latestCompleted.doctorId || {};
      const lHosp = latestCompleted.hospitalId || {};
      latestCompletedConsultation = {
        appointmentId: latestCompleted._id.toString(),
        displayAppointmentId:
          latestCompleted.displayAppointmentId ||
          latestCompleted.appointmentId ||
          \`APT-\${latestCompleted._id.toString().slice(-6).toUpperCase()}\`,
        doctorId: lDoc._id?.toString() || latestCompleted.doctorId?.toString(),
        doctorName: lDoc.name || "Doctor",
        doctorSpecialty: lDoc.speciality || "Specialist",
        hospitalName: lHosp.name || latestCompleted.hospitalName || "HealPoint Hospital",
        slotDate: latestCompleted.slotDate,
        slotTime: latestCompleted.slotTime,
        consultationType: latestCompleted.consultationType || "clinic",
        hasPrescription: Boolean(latestCompleted.prescription || (latestCompleted.medicines && latestCompleted.medicines.length > 0)),
        hasReports: Boolean(latestCompleted.medicalReports && latestCompleted.medicalReports.length > 0),
        reportStatus: latestCompleted.medicalReports && latestCompleted.medicalReports.length > 0 ? "available" : "none",
      };
    }

    let activeState = "No Active Follow-Up";
    let smartNextAction = {
      key: "book_visit",
      label: "Book Consultation",
      description: "Schedule an appointment with a verified healthcare specialist.",
      variant: "primary",
      icon: "calendar-outline",
      route: "/doctors",
    };

    if (scheduled > 0) {
      activeState = "Follow-Up Scheduled";
      smartNextAction = {
        key: "view_scheduled",
        label: "View Scheduled Appointments",
        description: "You have a confirmed follow-up visit scheduled.",
        variant: "secondary",
        icon: "checkmark-circle-outline",
        route: "/appointments",
      };
    } else if (pendingBooking > 0) {
      activeState = "Follow-Up Required";
      smartNextAction = {
        key: "book_followup",
        label: "Book Recommended Follow-Up",
        description: "Your doctor recommended a follow-up consultation.",
        variant: "primary",
        icon: "repeat-outline",
        route: "/appointments",
      };
    } else if (latestCompletedConsultation?.hasPrescription) {
      activeState = "Prescription Available";
      smartNextAction = {
        key: "view_prescription",
        label: "View Prescribed Medicines",
        description: "Check your medication schedule and dosage instructions.",
        variant: "secondary",
        icon: "document-text-outline",
        route: "/health/prescriptions",
      };
    } else if (latestCompletedConsultation) {
      activeState = "Consultation Completed";
    }

    const continuityOverview = {
      activeState,
      smartNextAction,
      latestCompletedConsultation,
      stats: {
        totalFollowUps: total,
        pendingBooking,
        scheduled,
        completed,
        activeReferrals: 0,
        activeHandovers: 0,
      },
    };

    return res.status(200).json({
      success: true,
      followUps,
      stats: {
        total,
        pendingBooking,
        scheduled,
        completed,
      },
      continuityOverview,
      patient: {
        _id: user._id.toString(),
        name: user.name || "Patient",
        familyMembers: user.familyMembers || [],
      },
    });
  } catch (error) {
    console.error("[getPatientFollowUps Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
`;
  controllerCode += followUpFn;
  fs.writeFileSync(controllerPath, controllerCode, "utf8");
  console.log("Appended getPatientFollowUps to appointmentController.js");
}

// 2. Patch appointmentRoutes.js
const routesPath = path.resolve("HealPointBackend/routes/appointmentRoutes.js");
let routesCode = fs.readFileSync(routesPath, "utf8");

if (!routesCode.includes("getPatientFollowUps")) {
  routesCode = routesCode.replace(
    'import {',
    'import {\n  getPatientFollowUps,'
  );

  routesCode = routesCode.replace(
    'router.get("/patient/medical-history", authenticate, getPatientMedicalHistory);',
    'router.get("/patient/medical-history", authenticate, getPatientMedicalHistory);\nrouter.get("/patient/follow-ups", authenticate, getPatientFollowUps);\nrouter.get("/patient/care-continuity", authenticate, getPatientFollowUps);'
  );

  fs.writeFileSync(routesPath, routesCode, "utf8");
  console.log("Added /patient/follow-ups route to appointmentRoutes.js");
}

