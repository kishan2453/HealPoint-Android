import mongoose from "mongoose";
import prescriptionModel from "../models/prescriptionModel.js";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import hospitalModel from "../models/hospitalModel.js";
import medicationReminderModel from "../models/medicationReminderModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";
import { generatePrescriptionPdfBuffer } from "../services/prescriptionPdfService.js";
import { dispatchNotification } from "../services/socketService.js";

// Helper to generate unique prescription reference number
function generateRxNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `RX-${dateStr}-${randomSuffix}`;
}

// Helper to calculate end date from duration
function calculateEndDate(startDate, durationStr) {
  const start = new Date(startDate || Date.now());
  const match = String(durationStr || "").match(/(\d+)/);
  const days = match ? parseInt(match[1], 10) : 5;
  const end = new Date(start);
  end.setDate(end.getDate() + (days > 0 ? days : 5));
  return end;
}

// Helper to resolve times from frequency
function parseScheduleTimes(frequency) {
  const freq = String(frequency || "").toLowerCase().trim();
  if (freq === "1-0-1") return ["08:00 AM", "08:00 PM"];
  if (freq === "1-1-1") return ["08:00 AM", "01:00 PM", "08:00 PM"];
  if (freq === "1-0-0" || freq.includes("once")) return ["08:00 AM"];
  if (freq === "0-1-0") return ["01:00 PM"];
  if (freq === "0-0-1") return ["08:00 PM"];
  if (freq.includes("twice")) return ["08:00 AM", "08:00 PM"];
  if (freq.includes("thrice")) return ["08:00 AM", "01:00 PM", "08:00 PM"];
  return ["08:00 AM", "08:00 PM"];
}

/**
 * 1. Create or Update Prescription Draft (Doctor Only)
 */
export const savePrescriptionDraft = async (req, res) => {
  try {
    const doctorId = req.user?.id || req.user?._id;
    const { appointmentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Valid appointmentId is required" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // Authorization: Only the treating doctor can create/draft prescriptions
    if (String(appointment.doctorId) !== String(doctorId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to issue prescriptions for this appointment",
      });
    }

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId");
    const patient = await userModel.findById(appointment.userId);
    const hospital = appointment.hospitalId
      ? await hospitalModel.findById(appointment.hospitalId)
      : doctor?.hospitalId;

    let prescription = await prescriptionModel.findOne({ appointmentId });

    const medicines = (req.body.medicines || []).map((m) => ({
      name: m.name,
      strength: m.strength || "",
      form: m.form || "Tablet",
      dosage: m.dosage || "1 Tablet",
      frequency: m.frequency || "1-0-1",
      duration: m.duration || "5 days",
      durationDays: parseInt(String(m.duration || "").match(/\d+/)?.[0] || "5", 10),
      route: m.route || "Oral",
      timing: m.timing || "After food",
      instructions: m.instructions || "",
      scheduleTimes: m.scheduleTimes?.length ? m.scheduleTimes : parseScheduleTimes(m.frequency),
      startDate: m.startDate ? new Date(m.startDate) : new Date(),
      endDate: calculateEndDate(m.startDate || new Date(), m.duration),
    }));

    if (!prescription) {
      prescription = new prescriptionModel({
        prescriptionNumber: generateRxNumber(),
        appointmentId,
        doctorId,
        hospitalId: hospital?._id || appointment.hospitalId || doctor?.hospitalId?._id,
        patientId: appointment.userId,
        familyMemberId: appointment.familyMemberId || null,
        patientSnapshot: {
          name: patient?.name || appointment.patientName || "Patient",
          age: patient?.age || (patient?.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()}` : "—"),
          gender: patient?.gender || "—",
          phone: patient?.phone || "",
          displayId: patient?.displayId || String(appointment.userId).slice(-8).toUpperCase(),
        },
        doctorSnapshot: {
          name: doctor?.name || "Attending Doctor",
          qualification: doctor?.qualification || "MBBS",
          speciality: doctor?.speciality || "General Physician",
          registrationNumber: doctor?.registrationNumber || "MCI-HP-REG",
          phone: doctor?.phone || "",
        },
        hospitalSnapshot: {
          name: hospital?.name || "HealPoint Partner Hospital",
          address: hospital?.address || "",
          city: hospital?.city || "",
          phone: hospital?.phone || "",
        },
        diagnosis: req.body.diagnosis || "",
        symptoms: req.body.symptoms || [],
        vitals: req.body.vitals || {},
        medicines,
        generalInstructions: req.body.generalInstructions || "",
        dietInstructions: req.body.dietInstructions || "",
        followUpDate: req.body.followUpDate ? new Date(req.body.followUpDate) : null,
        followUpInstructions: req.body.followUpInstructions || "",
        status: "draft",
      });
    } else {
      if (prescription.status === "issued") {
        return res.status(400).json({
          success: false,
          message: "Prescription is already issued. Please use the amend workflow to record changes.",
        });
      }
      prescription.diagnosis = req.body.diagnosis || prescription.diagnosis;
      prescription.medicines = medicines;
      prescription.vitals = req.body.vitals || prescription.vitals;
      prescription.generalInstructions = req.body.generalInstructions || prescription.generalInstructions;
      prescription.dietInstructions = req.body.dietInstructions || prescription.dietInstructions;
      prescription.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : prescription.followUpDate;
      prescription.followUpInstructions = req.body.followUpInstructions || prescription.followUpInstructions;
    }

    await prescription.save();

    return res.status(200).json({
      success: true,
      message: "Prescription draft saved successfully",
      prescription,
    });
  } catch (error) {
    console.error("[savePrescriptionDraft Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Issue and Finalize Digital Prescription (Doctor Only)
 */
export const issuePrescription = async (req, res) => {
  try {
    const doctorId = req.user?.id || req.user?._id;
    const { appointmentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Valid appointmentId is required" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // Authorization: Only the assigned treating doctor can issue
    if (String(appointment.doctorId) !== String(doctorId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only the assigned treating doctor can officially issue this prescription",
      });
    }

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId");
    const patient = await userModel.findById(appointment.userId);
    const hospital = appointment.hospitalId
      ? await hospitalModel.findById(appointment.hospitalId)
      : doctor?.hospitalId;

    let prescription = await prescriptionModel.findOne({ appointmentId });

    const medicines = (req.body.medicines || []).map((m) => ({
      name: m.name,
      strength: m.strength || "",
      form: m.form || "Tablet",
      dosage: m.dosage || "1 Tablet",
      frequency: m.frequency || "1-0-1",
      duration: m.duration || "5 days",
      durationDays: parseInt(String(m.duration || "").match(/\d+/)?.[0] || "5", 10),
      route: m.route || "Oral",
      timing: m.timing || "After food",
      instructions: m.instructions || "",
      scheduleTimes: m.scheduleTimes?.length ? m.scheduleTimes : parseScheduleTimes(m.frequency),
      startDate: m.startDate ? new Date(m.startDate) : new Date(),
      endDate: calculateEndDate(m.startDate || new Date(), m.duration),
    }));

    if (!prescription) {
      prescription = new prescriptionModel({
        prescriptionNumber: generateRxNumber(),
        appointmentId,
        doctorId,
        hospitalId: hospital?._id || appointment.hospitalId || doctor?.hospitalId?._id,
        patientId: appointment.userId,
        familyMemberId: appointment.familyMemberId || null,
        patientSnapshot: {
          name: patient?.name || appointment.patientName || "Patient",
          age: patient?.age || (patient?.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()}` : "—"),
          gender: patient?.gender || "—",
          phone: patient?.phone || "",
          displayId: patient?.displayId || String(appointment.userId).slice(-8).toUpperCase(),
        },
        doctorSnapshot: {
          name: doctor?.name || "Attending Doctor",
          qualification: doctor?.qualification || "MBBS",
          speciality: doctor?.speciality || "General Physician",
          registrationNumber: doctor?.registrationNumber || "MCI-HP-REG",
          phone: doctor?.phone || "",
        },
        hospitalSnapshot: {
          name: hospital?.name || "HealPoint Partner Hospital",
          address: hospital?.address || "",
          city: hospital?.city || "",
          phone: hospital?.phone || "",
        },
      });
    }

    prescription.diagnosis = req.body.diagnosis || prescription.diagnosis || appointment.diagnosis || "";
    prescription.symptoms = req.body.symptoms || prescription.symptoms || [];
    prescription.vitals = req.body.vitals || prescription.vitals || {};
    prescription.medicines = medicines.length ? medicines : prescription.medicines;
    prescription.generalInstructions = req.body.generalInstructions || prescription.generalInstructions || "";
    prescription.dietInstructions = req.body.dietInstructions || prescription.dietInstructions || "";
    prescription.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : prescription.followUpDate;
    prescription.followUpInstructions = req.body.followUpInstructions || prescription.followUpInstructions || "";

    prescription.status = "issued";
    prescription.isDigitallySigned = true;
    prescription.signedAt = new Date();
    prescription.signedByDoctorId = doctorId;
    prescription.doctorSignatureStamp = doctor?.signatureImage || "DIGITALLY-SIGNED-HEALPOINT";

    await prescription.save();

    // 1. Sync back to appointment record for backward compatibility
    appointment.diagnosis = prescription.diagnosis;
    appointment.prescription = prescription.prescriptionNumber;
    appointment.medicines = prescription.medicines.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: [m.timing, m.instructions].filter(Boolean).join(" · "),
    }));
    appointment.prescriptionInstructions = {
      dietInstructions: prescription.dietInstructions,
      generalInstructions: prescription.generalInstructions,
      followUpInstructions: prescription.followUpInstructions,
    };
    appointment.followUpAdvice = prescription.followUpInstructions;
    await appointment.save();

    // 2. Auto-provision medication reminders for the patient
    for (const med of prescription.medicines) {
      await medicationReminderModel.findOneAndUpdate(
        {
          userId: appointment.userId,
          appointmentId: appointment._id,
          medicineName: med.name,
        },
        {
          userId: appointment.userId,
          familyMemberId: appointment.familyMemberId || null,
          prescriptionId: prescription._id,
          appointmentId: appointment._id,
          doctorId,
          hospitalId: prescription.hospitalId,
          medicineName: med.name,
          strength: med.strength,
          dosage: med.dosage,
          frequency: med.frequency,
          timing: med.timing,
          instructions: med.instructions,
          startDate: med.startDate || new Date(),
          endDate: med.endDate || calculateEndDate(new Date(), med.duration),
          times: med.scheduleTimes?.length ? med.scheduleTimes : parseScheduleTimes(med.frequency),
          isActive: true,
          refillReminder: {
            enabled: med.durationDays >= 10,
            refillDate: med.endDate,
            remindBeforeDays: 2,
          },
          followUpReminder: {
            enabled: Boolean(prescription.followUpDate),
            followUpDate: prescription.followUpDate,
          },
        },
        { upsert: true, new: true }
      );
    }

    // 3. Integrate into Health Wallet (healthDocumentModel)
    await healthDocumentModel.findOneAndUpdate(
      {
        userId: appointment.userId,
        appointmentId: String(appointment._id),
        category: "prescription",
      },
      {
        userId: appointment.userId,
        familyMemberId: appointment.familyMemberId || null,
        title: `Digital Prescription - ${prescription.doctorSnapshot?.name || "Doctor"} (${prescription.prescriptionNumber})`,
        category: "prescription",
        documentDate: new Date().toISOString().slice(0, 10),
        fileName: `Prescription-${prescription.prescriptionNumber}.pdf`,
        mimeType: "application/pdf",
        hospitalId: prescription.hospitalId,
        hospitalName: prescription.hospitalSnapshot?.name || "",
        doctorId,
        doctorName: prescription.doctorSnapshot?.name || "",
        appointmentId: String(appointment._id),
        notes: prescription.diagnosis ? `Diagnosis: ${prescription.diagnosis}` : "Issued Digital Prescription",
        isArchived: false,
        processingStatus: "processed",
      },
      { upsert: true }
    );

        try {
      dispatchNotification({
        userId: prescription.userId,
        recipientRole: "patient",
        title: "Digital Prescription Issued",
        message: `Dr. ${prescription.doctorName} has issued your official digital prescription (${prescription.medicines?.length || 0} medicines).`,
        type: "prescription",
        category: "prescription",
        priority: "normal",
        link: `/health/prescriptions`,
        refId: prescription._id.toString(),
        refModel: "Prescription",
      }).catch(() => {});
    } catch (err) {}

    return res.status(200).json({
      success: true,
      message: "Prescription officially issued and signed successfully",
      prescription,
    });
  } catch (error) {
    console.error("[issuePrescription Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Amend Prescription with Version Audit History (Doctor Only)
 */
export const amendPrescription = async (req, res) => {
  try {
    const doctorId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const { amendmentReason, diagnosis, medicines, generalInstructions, dietInstructions, followUpDate, followUpInstructions } = req.body;

    if (!amendmentReason) {
      return res.status(400).json({ success: false, message: "Clinical amendment reason is required" });
    }

    const prescription = await prescriptionModel.findById(id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    if (String(prescription.doctorId) !== String(doctorId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only the issuing doctor can amend this prescription",
      });
    }

    // Store snapshot of previous version into history
    const previousSnapshot = {
      diagnosis: prescription.diagnosis,
      medicines: prescription.medicines,
      generalInstructions: prescription.generalInstructions,
      dietInstructions: prescription.dietInstructions,
      followUpDate: prescription.followUpDate,
      followUpInstructions: prescription.followUpInstructions,
      version: prescription.version,
    };

    prescription.history.push({
      version: prescription.version,
      amendedAt: new Date(),
      amendedBy: doctorId,
      amendmentReason,
      snapshot: previousSnapshot,
    });

    prescription.version += 1;
    prescription.status = "amended";

    if (diagnosis !== undefined) prescription.diagnosis = diagnosis;
    if (generalInstructions !== undefined) prescription.generalInstructions = generalInstructions;
    if (dietInstructions !== undefined) prescription.dietInstructions = dietInstructions;
    if (followUpDate !== undefined) prescription.followUpDate = followUpDate ? new Date(followUpDate) : null;
    if (followUpInstructions !== undefined) prescription.followUpInstructions = followUpInstructions;

    if (Array.isArray(medicines) && medicines.length) {
      prescription.medicines = medicines.map((m) => ({
        name: m.name,
        strength: m.strength || "",
        form: m.form || "Tablet",
        dosage: m.dosage || "1 Tablet",
        frequency: m.frequency || "1-0-1",
        duration: m.duration || "5 days",
        durationDays: parseInt(String(m.duration || "").match(/\d+/)?.[0] || "5", 10),
        route: m.route || "Oral",
        timing: m.timing || "After food",
        instructions: m.instructions || "",
        scheduleTimes: m.scheduleTimes?.length ? m.scheduleTimes : parseScheduleTimes(m.frequency),
        startDate: m.startDate ? new Date(m.startDate) : new Date(),
        endDate: calculateEndDate(m.startDate || new Date(), m.duration),
      }));
    }

    await prescription.save();

    return res.status(200).json({
      success: true,
      message: `Prescription successfully amended (Version ${prescription.version})`,
      prescription,
    });
  } catch (error) {
    console.error("[amendPrescription Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Get Prescription Details By ID
 */
export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const role = req.user?.role;

    let prescription = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      prescription = await prescriptionModel
        .findOne({ $or: [{ _id: id }, { appointmentId: id }] })
        .populate("doctorId", "name speciality qualification degree registrationNumber hospitalName phone image")
        .populate("hospitalId", "name address city phone email")
        .populate("patientId", "name email phone image gender age dob");
    } else {
      prescription = await prescriptionModel
        .findOne({ prescriptionNumber: id })
        .populate("doctorId", "name speciality qualification degree registrationNumber hospitalName phone image")
        .populate("hospitalId", "name address city phone email")
        .populate("patientId", "name email phone image gender age dob");
    }

    if (!prescription) {
      // Fallback: check if appointment exists with legacy medicines
      if (mongoose.Types.ObjectId.isValid(id)) {
        const apt = await appointmentModel
          .findById(id)
          .populate("doctorId", "name speciality qualification degree registrationNumber hospitalName phone image")
          .populate("hospitalId", "name address city phone email")
          .populate("userId", "name email phone image gender age dob");

        if (apt && (apt.prescription || (apt.medicines && apt.medicines.length > 0))) {
          return res.status(200).json({
            success: true,
            prescription: {
              _id: apt._id,
              prescriptionNumber: apt.prescription || `RX-${String(apt._id).slice(-8).toUpperCase()}`,
              appointmentId: apt._id,
              doctorId: apt.doctorId,
              hospitalId: apt.hospitalId,
              patientId: apt.userId,
              diagnosis: apt.diagnosis || "",
              medicines: apt.medicines || [],
              generalInstructions: apt.prescriptionInstructions?.generalInstructions || "",
              dietInstructions: apt.prescriptionInstructions?.dietInstructions || "",
              followUpInstructions: apt.prescriptionInstructions?.followUpInstructions || apt.followUpAdvice || "",
              status: "issued",
              isDigitallySigned: true,
              signedAt: apt.updatedAt || apt.createdAt,
            },
          });
        }
      }
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    // Healthcare Privacy & Access Control Check
    const isPatient = String(prescription.patientId?._id || prescription.patientId) === String(userId);
    const isDoctor = String(prescription.doctorId?._id || prescription.doctorId) === String(userId);
    const isSuperAdmin = role === "Super Admin" || req.user?.isAdmin;
    const isHospitalAdmin = req.user?.hospitalId && String(prescription.hospitalId?._id || prescription.hospitalId) === String(req.user.hospitalId);

    if (!isPatient && !isDoctor && !isSuperAdmin && !isHospitalAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You do not have authorization to view this prescription",
      });
    }

    return res.status(200).json({
      success: true,
      prescription,
    });
  } catch (error) {
    console.error("[getPrescriptionById Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Download / Stream Professional Prescription PDF
 */
export const downloadPrescriptionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const role = req.user?.role;

    let prescription = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      prescription = await prescriptionModel.findOne({
        $or: [{ _id: id }, { appointmentId: id }],
      });
    } else {
      prescription = await prescriptionModel.findOne({ prescriptionNumber: id });
    }

    // Fallback: build on-the-fly for legacy appointments
    if (!prescription && mongoose.Types.ObjectId.isValid(id)) {
      const apt = await appointmentModel
        .findById(id)
        .populate("doctorId", "name speciality qualification registrationNumber phone")
        .populate("hospitalId", "name address city phone")
        .populate("userId", "name age gender dob");

      if (apt && (apt.prescription || (apt.medicines && apt.medicines.length > 0))) {
        prescription = {
          prescriptionNumber: apt.prescription || `RX-${String(apt._id).slice(-8).toUpperCase()}`,
          patientId: apt.userId?._id || apt.userId,
          doctorId: apt.doctorId?._id || apt.doctorId,
          hospitalId: apt.hospitalId?._id || apt.hospitalId,
          patientSnapshot: {
            name: apt.userId?.name || apt.patientName || "Patient",
            age: apt.userId?.age || "—",
            gender: apt.userId?.gender || "—",
            displayId: String(apt.userId?._id || "").slice(-8).toUpperCase(),
          },
          doctorSnapshot: {
            name: apt.doctorId?.name || "Attending Doctor",
            qualification: apt.doctorId?.qualification || "Consultant Physician",
            speciality: apt.doctorId?.speciality || "General Medicine",
            registrationNumber: apt.doctorId?.registrationNumber || "MCI-HP-REG",
            phone: apt.doctorId?.phone || "",
          },
          hospitalSnapshot: {
            name: apt.hospitalId?.name || "HealPoint Partner Hospital",
            address: apt.hospitalId?.address || "",
            city: apt.hospitalId?.city || "",
          },
          diagnosis: apt.diagnosis || "",
          medicines: apt.medicines || [],
          generalInstructions: apt.prescriptionInstructions?.generalInstructions || "",
          dietInstructions: apt.prescriptionInstructions?.dietInstructions || "",
          followUpInstructions: apt.prescriptionInstructions?.followUpInstructions || apt.followUpAdvice || "",
          createdAt: apt.createdAt,
          isDigitallySigned: true,
          signedAt: apt.updatedAt || apt.createdAt,
        };
      }
    }

    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    // Access authorization
    const isPatient = String(prescription.patientId?._id || prescription.patientId) === String(userId);
    const isDoctor = String(prescription.doctorId?._id || prescription.doctorId) === String(userId);
    const isSuperAdmin = role === "Super Admin" || req.user?.isAdmin;
    const isHospitalAdmin = req.user?.hospitalId && String(prescription.hospitalId?._id || prescription.hospitalId) === String(req.user.hospitalId);

    if (!isPatient && !isDoctor && !isSuperAdmin && !isHospitalAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You cannot download this prescription PDF",
      });
    }

    const pdfBuffer = await generatePrescriptionPdfBuffer(prescription);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Prescription-${prescription.prescriptionNumber}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("[downloadPrescriptionPdf Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Get Patient Prescriptions (For Mobile & Health Wallet)
 */
export const getPatientPrescriptions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { familyMemberId, status } = req.query;

    const query = { patientId: userId };
    if (familyMemberId && familyMemberId !== "all") {
      query.familyMemberId = familyMemberId;
    }
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ["issued", "amended"] }; // Default to finalized prescriptions for patients
    }

    const prescriptions = await prescriptionModel
      .find(query)
      .populate("doctorId", "name speciality qualification degree registrationNumber hospitalName phone image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("[getPatientPrescriptions Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. Get Hospital Admin Prescription Statistics (Tenant Isolated)
 */
export const getHospitalPrescriptionStats = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId || req.params.hospitalId;
    if (!hospitalId || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ success: false, message: "Valid hospitalId is required" });
    }

    const [totalPrescriptions, issuedCount, draftCount, amendedCount] = await Promise.all([
      prescriptionModel.countDocuments({ hospitalId }),
      prescriptionModel.countDocuments({ hospitalId, status: "issued" }),
      prescriptionModel.countDocuments({ hospitalId, status: "draft" }),
      prescriptionModel.countDocuments({ hospitalId, status: "amended" }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: totalPrescriptions,
        issued: issuedCount,
        drafts: draftCount,
        amended: amendedCount,
      },
    });
  } catch (error) {
    console.error("[getHospitalPrescriptionStats Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Get Super Admin Platform Prescription Statistics
 */
export const getSuperAdminPrescriptionStats = async (req, res) => {
  try {
    if (!req.user?.isAdmin && req.user?.role !== "Super Admin") {
      return res.status(403).json({ success: false, message: "Access Denied: Super Admin only" });
    }

    const [total, issued, activeReminders] = await Promise.all([
      prescriptionModel.countDocuments(),
      prescriptionModel.countDocuments({ status: { $in: ["issued", "amended"] } }),
      medicationReminderModel.countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalPrescriptions: total,
        totalIssued: issued,
        activeMedicationReminders: activeReminders,
      },
    });
  } catch (error) {
    console.error("[getSuperAdminPrescriptionStats Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
