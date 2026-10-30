import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";

const DEFAULT_DISCLAIMER =
  "HealPoint AI provides healthcare navigation and triage guidance only. It does not provide definitive medical diagnoses or replace a certified doctor consultation.";

export const chatWithAi = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const lower = message.toLowerCase();

    // Check for emergency keywords
    const isEmergency = ["chest pain", "heart attack", "cannot breathe", "severe bleeding", "unconscious"].some(
      (term) => lower.includes(term)
    );

    if (isEmergency) {
      return res.status(200).json({
        success: true,
        reply:
          "EMERGENCY ALERT: Your symptoms may indicate a critical medical condition. Please call 108 / 112 immediately or proceed to the nearest emergency room.",
        isEmergency: true,
        disclaimer: DEFAULT_DISCLAIMER,
      });
    }

    // Keyword matching for doctor specialty triage
    let suggestedSpeciality = "General Physician";
    if (lower.includes("heart") || lower.includes("cardio")) suggestedSpeciality = "Cardiologist";
    else if (lower.includes("skin") || lower.includes("rash") || lower.includes("itch")) suggestedSpeciality = "Dermatologist";
    else if (lower.includes("tooth") || lower.includes("teeth") || lower.includes("dental")) suggestedSpeciality = "Dentist";
    else if (lower.includes("bone") || lower.includes("joint") || lower.includes("fracture")) suggestedSpeciality = "Orthopedic";
    else if (lower.includes("child") || lower.includes("baby") || lower.includes("pediatric")) suggestedSpeciality = "Pediatrician";
    else if (lower.includes("brain") || lower.includes("headache") || lower.includes("nerve")) suggestedSpeciality = "Neurologist";

    // Query real matching doctors from MongoDB
    const suggestedDoctors = await doctorModel
      .find({ speciality: { $regex: suggestedSpeciality, $options: "i" }, isActive: true })
      .limit(3)
      .select("name speciality fees rating image hospitalName");

    res.status(200).json({
      success: true,
      reply: `Based on your symptoms, we recommend consulting a **${suggestedSpeciality}**. Here are top-rated specialists available on HealPoint:`,
      suggestedSpeciality,
      suggestedDoctors,
      disclaimer: DEFAULT_DISCLAIMER,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
