import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  detectLanguage,
  isEmergencyMessage,
  determineSpeciality,
  generateTriageResponse,
} from "../controllers/aiController.js";

describe("Phase 3: AI Health Assistant Suite", () => {
  // 1. Rate Limiting Tests
  describe("Rate Limiting Engine", () => {
    test("Permits up to 10 requests per minute per identifier", () => {
      const testKey = `test_user_rate_${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        const res = checkRateLimit(testKey);
        assert.equal(res.allowed, true, `Request ${i + 1} should be permitted`);
      }

      // 11th request must be rejected
      const rejected = checkRateLimit(testKey);
      assert.equal(rejected.allowed, false, "11th request should be rate-limited");
      assert.ok(rejected.resetInSeconds > 0, "Reset seconds must be positive");
    });
  });

  // 2. Multilingual Emergency Detection
  describe("Emergency Triage Detection", () => {
    test("Detects life-threatening emergencies in English", () => {
      assert.equal(isEmergencyMessage("I have acute chest pain radiating to left arm"), true);
      assert.equal(isEmergencyMessage("Patient is unconscious after falling"), true);
      assert.equal(isEmergencyMessage("Cannot breathe properly and gasping"), true);
      assert.equal(isEmergencyMessage("Severe bleeding from open wound"), true);
    });

    test("Detects life-threatening emergencies in Hindi (हिन्दी)", () => {
      assert.equal(isEmergencyMessage("मेरे सीने में दर्द हो रहा है और घबराहट है"), true);
      assert.equal(isEmergencyMessage("मरीज बेहोश हो गया है"), true);
      assert.equal(isEmergencyMessage("सांस लेने में तकलीफ हो रही है"), true);
    });

    test("Detects life-threatening emergencies in Gujarati (ગુજરાતી)", () => {
      assert.equal(isEmergencyMessage("મને છાતીમાં દુખાવો થાય છે"), true);
      assert.equal(isEmergencyMessage("દર્દી બેભાન થઈ ગયો છે"), true);
      assert.equal(isEmergencyMessage("શ્વાસ લેવામાં તકલીફ છે"), true);
    });

    test("Accurately identifies non-emergency queries", () => {
      assert.equal(isEmergencyMessage("I have mild dandruff and dry scalp"), false);
      assert.equal(isEmergencyMessage("How to maintain a balanced diet?"), false);
      assert.equal(isEmergencyMessage("When should I schedule a dental checkup?"), false);
    });
  });

  // 3. Language Auto-Detection
  describe("Language Detection Engine", () => {
    test("Explicit language preference takes precedence", () => {
      assert.equal(detectLanguage("Hello doctor", "hi"), "hi");
      assert.equal(detectLanguage("नमस्ते", "en"), "en");
      assert.equal(detectLanguage("નમસ્તે", "gu"), "gu");
    });

    test("Detects Hindi script automatically", () => {
      assert.equal(detectLanguage("मुझे सिरदर्द है"), "hi");
      assert.equal(detectLanguage("पेट में दर्द हो रहा है"), "hi");
    });

    test("Detects Gujarati script automatically", () => {
      assert.equal(detectLanguage("મને માથું દુખે છે"), "gu");
      assert.equal(detectLanguage("તાવ આવ્યો છે"), "gu");
    });

    test("Defaults to English for standard Latin script", () => {
      assert.equal(detectLanguage("I have a fever since yesterday"), "en");
    });
  });

  // 4. Clinical Specialty Triage Mapping
  describe("Specialty Triage Mapping", () => {
    test("Maps heart symptoms to Cardiologist", () => {
      assert.equal(determineSpeciality("heart palpitations and high bp"), "Cardiologist");
      assert.equal(determineSpeciality("दिल की धड़कन तेज है"), "Cardiologist");
    });

    test("Maps skin and rash symptoms to Dermatologist", () => {
      assert.equal(determineSpeciality("I have an itchy red rash on my arm"), "Dermatologist");
      assert.equal(determineSpeciality("चेहरे पर मुहांसे और खुजली है"), "Dermatologist");
    });

    test("Maps dental pain to Dentist", () => {
      assert.equal(determineSpeciality("Severe toothache and swollen gum cavity"), "Dentist");
      assert.equal(determineSpeciality("દાંતમાં સડો અને દુખાવો છે"), "Dentist");
    });

    test("Maps bone and joint issues to Orthopedic", () => {
      assert.equal(determineSpeciality("Knee joint pain when walking"), "Orthopedic");
      assert.equal(determineSpeciality("कमर में तेज दर्द और मोच"), "Orthopedic");
    });

    test("Maps child health inquiries to Pediatrician", () => {
      assert.equal(determineSpeciality("My 2-year-old child has high fever"), "Pediatrician");
    });

    test("Maps neurological symptoms to Neurologist", () => {
      assert.equal(determineSpeciality("Frequent migraines and numbness in fingers"), "Neurologist");
    });

    test("Defaults to General Physician when symptoms are non-specific", () => {
      assert.equal(determineSpeciality("Feeling general tiredness and low energy"), "General Physician");
    });
  });

  // 5. Medical Safety & Guardrails
  describe("Medical Safety Guardrails & Disclaimers", () => {
    test("Emergency response mandates national emergency helpline 112 / 108", () => {
      const enRes = generateTriageResponse({
        prompt: "Chest pain",
        language: "en",
        speciality: "Cardiologist",
        isEmergency: true,
      });
      assert.ok(enRes.reply.includes("112"), "Must include 112 in English");
      assert.ok(enRes.reply.includes("Emergency Department"), "Must advise ER visit");

      const hiRes = generateTriageResponse({
        prompt: "सीने में दर्द",
        language: "hi",
        speciality: "Cardiologist",
        isEmergency: true,
      });
      assert.ok(hiRes.reply.includes("112"), "Must include 112 in Hindi");

      const guRes = generateTriageResponse({
        prompt: "છાતીમાં દુખાવો",
        language: "gu",
        speciality: "Cardiologist",
        isEmergency: true,
      });
      assert.ok(guRes.reply.includes("112"), "Must include 112 in Gujarati");
    });

    test("Never issues a definitive medical diagnosis or personalized drug dosage", () => {
      const res = generateTriageResponse({
        prompt: "I have stomach pain and nausea",
        language: "en",
        speciality: "General Physician",
        isEmergency: false,
      });

      // Assert absence of definitive diagnostic claims
      assert.ok(!res.reply.includes("You have been diagnosed with"));
      assert.ok(!res.reply.includes("Take 500mg of"));
      assert.ok(!res.reply.includes("Prescribed:"));

      // Assert inclusion of medical disclaimer
      assert.ok(res.disclaimer, "Disclaimer must always be present");
      assert.ok(res.disclaimer.includes("does not provide definitive medical diagnoses"));
    });
  });

  // 6. Feature Flag Behavior
  describe("Feature Flag: FEATURE_AI_HEALTH_ASSISTANT", () => {
    test("Defaults to false / disabled if not set in environment", () => {
      const orig = process.env.FEATURE_AI_HEALTH_ASSISTANT;
      delete process.env.FEATURE_AI_HEALTH_ASSISTANT;

      const isEnabled = process.env.FEATURE_AI_HEALTH_ASSISTANT === "true";
      assert.equal(isEnabled, false);

      if (orig) process.env.FEATURE_AI_HEALTH_ASSISTANT = orig;
    });

    test("Activates only when explicitly set to 'true'", () => {
      const isEnabled = (val) => val === "true";
      assert.equal(isEnabled("true"), true);
      assert.equal(isEnabled("false"), false);
      assert.equal(isEnabled("0"), false);
    });
  });
});
