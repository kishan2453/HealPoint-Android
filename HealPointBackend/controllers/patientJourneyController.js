import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import prescriptionModel from "../models/prescriptionModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";
import doctorModel from "../models/doctorModel.js";

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

/**
 * Aggregates a patient's entire journey across registrations, appointments,
 * consultations, prescriptions, health documents, follow-ups, and billing
 * without duplicating records across collections.
 */
export const getPatientJourneyTimeline = async (req, res) => {
  try {
    const targetUserId = req.params.patientId || req.user.id;

    if (!isValidId(targetUserId)) {
      return res.status(400).json({ success: false, message: "Valid Patient ID is required" });
    }

    // Role-based Access Control
    if (req.user.role === "patient" || req.user.role === "user") {
      if (String(req.user.id) !== String(targetUserId)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You may only view your own patient journey timeline",
        });
      }
    } else if (req.user.role === "doctor" || req.user.role === "Doctor") {
      // Doctor must be associated with this patient via at least one appointment
      const hasRelation = await appointmentModel.exists({
        doctorId: req.user.id,
        userId: targetUserId,
      });
      if (!hasRelation) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are only authorized to view journeys of your assigned patients",
        });
      }
    }

    const patient = await userModel.findById(targetUserId).select("name email phone createdAt image dob gender bloodGroup");
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const { category = "all", startDate, endDate, page = 1, limit = 50 } = req.query;

    const timeline = [];

    // 1. Patient Registration Event
    if (category === "all" || category === "account") {
      timeline.push({
        id: `reg-${patient._id}`,
        type: "registration",
        category: "account",
        title: "Account Registered",
        description: "Patient profile created on Anand HealPoint",
        timestamp: patient.createdAt || new Date(0),
        status: "completed",
        badgeColor: "#2563EB",
        icon: "user-plus",
        metadata: {
          name: patient.name,
          email: patient.email,
        },
      });
    }

    // 2. Appointments & Consultations & Billing
    if (category === "all" || category === "appointments" || category === "consultations" || category === "billing") {
      const apptQuery = { userId: targetUserId };
      const appointments = await appointmentModel
        .find(apptQuery)
        .populate("doctorId", "name speciality image department fees")
        .populate("hospitalId", "name location")
        .sort({ createdAt: -1 });

      appointments.forEach((appt) => {
        const apptDate = appt.createdAt || new Date();
        const docName = appt.doctorId?.name ? `Dr. ${appt.doctorId.name.replace(/^Dr\.\s*/i, "")}` : (appt.doctorName || "Doctor");
        const hospName = appt.hospitalId?.name || appt.hospitalName || "HealPoint Partner Hospital";

        // Appointment booking/scheduled event
        if (category === "all" || category === "appointments") {
          timeline.push({
            id: `appt-${appt._id}`,
            type: "appointment",
            category: "appointments",
            title: `Appointment ${appt.status.toUpperCase()}`,
            description: `${appt.consultationType === "video" ? "Video Consultation" : "In-Person OPD"} with ${docName} at ${hospName}`,
            timestamp: appt.createdAt,
            slotDate: appt.slotDate,
            slotTime: appt.slotTime,
            status: appt.status,
            badgeColor: appt.status === "completed" ? "#10B981" : appt.status === "cancel" ? "#EF4444" : "#2563EB",
            icon: "calendar",
            metadata: {
              appointmentId: appt.displayAppointmentId || appt.appointmentId,
              doctorName: docName,
              speciality: appt.doctorId?.speciality || "General",
              hospitalName: hospName,
              consultationType: appt.consultationType,
              queueToken: appt.queueToken || null,
              vitals: appt.vitals || null,
            },
          });
        }

        // Consultation completed record
        if ((category === "all" || category === "consultations") && appt.status === "completed") {
          timeline.push({
            id: `consult-${appt._id}`,
            type: "consultation",
            category: "consultations",
            title: `Clinical Consultation Completed`,
            description: `Consultation with ${docName}. Duration: ${Math.round((appt.consultationDurationSeconds || 900) / 60)} mins`,
            timestamp: appt.consultationEndedAt || appt.updatedAt || appt.createdAt,
            status: "completed",
            badgeColor: "#059669",
            icon: "stethoscope",
            metadata: {
              doctorName: docName,
              medicalNotes: appt.medicalNotes || appt.consultationNotes || "Regular checkup completed",
              vitals: appt.vitals || null,
            },
          });
        }

        // Billing event
        if ((category === "all" || category === "billing") && appt.amount > 0) {
          timeline.push({
            id: `bill-${appt._id}`,
            type: "billing",
            category: "billing",
            title: `Invoice Generated & Paid`,
            description: `Payment of ₹${appt.amount} for consultation with ${docName}`,
            timestamp: appt.createdAt,
            status: appt.paymentStatus || "paid",
            badgeColor: "#6366F1",
            icon: "receipt",
            metadata: {
              amount: appt.amount,
              paymentStatus: appt.paymentStatus || "paid",
              paymentMethod: appt.paymentMethod || "Online (Simulated)",
              billingDetails: appt.billing || {},
            },
          });
        }
      });
    }

    // 3. Prescriptions
    if (category === "all" || category === "prescriptions") {
      const prescriptions = await prescriptionModel
        .find({ userId: targetUserId })
        .populate("doctorId", "name speciality")
        .populate("hospitalId", "name")
        .sort({ issuedAt: -1, createdAt: -1 });

      prescriptions.forEach((rx) => {
        const docName = rx.doctorId?.name ? `Dr. ${rx.doctorId.name.replace(/^Dr\.\s*/i, "")}` : (rx.doctorName || "Doctor");
        const medCount = rx.medicines ? rx.medicines.length : 0;

        timeline.push({
          id: `rx-${rx._id}`,
          type: "prescription",
          category: "prescriptions",
          title: `Digital Prescription Issued`,
          description: `Prescribed by ${docName} (${medCount} medication${medCount !== 1 ? "s" : ""})`,
          timestamp: rx.issuedAt || rx.createdAt,
          status: rx.status || "issued",
          badgeColor: "#8B5CF6",
          icon: "file-text",
          metadata: {
            prescriptionId: rx.prescriptionId || String(rx._id),
            diagnosis: rx.diagnosis || "",
            doctorName: docName,
            hospitalName: rx.hospitalName || rx.hospitalId?.name || "HealPoint Partner Hospital",
            medicines: rx.medicines || [],
            digitalSignature: rx.digitalSignature ? "Verified" : "Pending",
          },
        });
      });
    }

    // 4. Uploaded Health Documents
    if (category === "all" || category === "records" || category === "documents") {
      const docs = await healthDocumentModel
        .find({ userId: targetUserId, isArchived: { $ne: true } })
        .sort({ recordDate: -1, createdAt: -1 });

      docs.forEach((doc) => {
        timeline.push({
          id: `doc-${doc._id}`,
          type: "health_record",
          category: "records",
          title: doc.title || "Health Document Uploaded",
          description: `${doc.recordType || "Medical Report"} added to Health Wallet`,
          timestamp: doc.recordDate || doc.createdAt,
          status: "verified",
          badgeColor: "#0EA5E9",
          icon: "folder",
          metadata: {
            recordType: doc.recordType,
            hospitalName: doc.hospitalName,
            doctorName: doc.doctorName,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
          },
        });
      });
    }

    // Sort all events strictly chronologically (newest first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by date range if provided
    let filtered = timeline;
    if (startDate) {
      const s = new Date(startDate).getTime();
      filtered = filtered.filter((item) => new Date(item.timestamp).getTime() >= s);
    }
    if (endDate) {
      const e = new Date(endDate).getTime();
      filtered = filtered.filter((item) => new Date(item.timestamp).getTime() <= e);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const totalEvents = filtered.length;
    const paginatedEvents = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const summary = {
      totalEvents,
      appointmentsCount: timeline.filter((t) => t.category === "appointments").length,
      consultationsCount: timeline.filter((t) => t.category === "consultations").length,
      prescriptionsCount: timeline.filter((t) => t.category === "prescriptions").length,
      recordsCount: timeline.filter((t) => t.category === "records").length,
      billingCount: timeline.filter((t) => t.category === "billing").length,
    };

    return res.status(200).json({
      success: true,
      patient: {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        dob: patient.dob,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
      },
      summary,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalEvents / limitNum) || 1,
        totalEvents,
        limit: limitNum,
      },
      timeline: paginatedEvents,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
