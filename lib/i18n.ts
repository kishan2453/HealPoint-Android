/**
 * HealPoint Localization & Internationalization (i18n) Engine
 * Supported languages: English (en), Hindi (hi - हिन्दी), Gujarati (gu - ગુજરાતી)
 *
 * NOTE: Preserves medical prescriptions, clinical handover notes,
 * doctor clinical IDs, and payment reference numbers unaltered.
 */

export type Language = "en" | "hi" | "gu";

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
];

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Drawer
    "nav.home": "Home",
    "nav.findDoctors": "Find Doctors",
    "nav.hospitals": "Hospitals",
    "nav.appointments": "Appointments",
    "nav.myAppointments": "My Appointments",
    "nav.consultOnline": "Consult Online",
    "nav.healthWallet": "Digital Health Wallet",
    "nav.medicalRecords": "Medical Records",
    "nav.healthGoals": "Health Goals",
    "nav.documentCenter": "Health Document Center",
    "nav.familyMembers": "Family Members",
    "nav.emergency": "Emergency SOS",
    "nav.carePassport": "Care Passport",
    "nav.careContinuity": "Care Continuity",
    "nav.commandCenter": "Care Command Center",
    "nav.careCommunity": "Care Community",
    "nav.support": "Help & Support",
    "nav.settings": "Settings",
    "nav.favorites": "Favorite Doctors & Hospitals",
    "nav.privacy": "Privacy Policy",
    "nav.terms": "Terms of Service",

    // Common Buttons & Actions
    "btn.bookAppointment": "Book Appointment",
    "btn.reschedule": "Reschedule",
    "btn.cancelAppointment": "Cancel Appointment",
    "btn.confirm": "Confirm",
    "btn.save": "Save Changes",
    "btn.savePreferences": "Save Preferences",
    "btn.submit": "Submit",
    "btn.search": "Search",
    "btn.filter": "Filter",
    "btn.clear": "Clear",
    "btn.payNow": "Pay Now",
    "btn.downloadPdf": "Download PDF",
    "btn.share": "Share",
    "btn.retry": "Retry",
    "btn.close": "Close",
    "btn.back": "Back",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.add": "Add",
    "btn.logout": "Log Out",
    "btn.viewAll": "View All",
    "btn.learnMore": "Learn More",

    // Status Badges
    "status.confirmed": "Confirmed",
    "status.pending": "Pending",
    "status.completed": "Completed",
    "status.cancelled": "Cancelled",
    "status.inProgress": "In Progress",
    "status.open": "Open",
    "status.resolved": "Resolved",
    "status.closed": "Closed",
    "status.active": "Active",
    "status.inactive": "Inactive",

    // Offline & Connectivity
    "offline.bannerTitle": "You are currently offline",
    "offline.bannerSubtitle": "You're offline. Available saved information is shown here. Reconnect to refresh information and synchronize changes.",
    "offline.backOnline": "Internet connection restored. Live sync active.",
    "offline.actionBlocked": "Internet connection required to book appointments or process payments.",

    // Settings & Preferences
    "settings.title": "Settings",
    "settings.language": "Language Preference",
    "settings.languageDesc": "Select your preferred application language",
    "settings.accessibility": "Accessibility Options",
    "settings.accessibilityDesc": "Adjust contrast, font scaling and screen reader options",
    "settings.highContrast": "High Contrast Mode",
    "settings.highContrastDesc": "Enhances readability and visual borders",
    "settings.fontSize": "Text Size",
    "settings.fontSizeNormal": "Normal",
    "settings.fontSizeLarge": "Large",
    "settings.fontSizeXLarge": "Extra Large",
    "settings.notifications": "Notification Preferences",
    "settings.notifAppointments": "Appointment Reminders",
    "settings.notifPrescriptions": "Prescription Updates",
    "settings.notifBilling": "Billing & Payments",
    "settings.account": "Account & Security",
    "settings.changeEmail": "Change Email Address",
    "settings.changePassword": "Change Password",
    "settings.savedSuccess": "Preferences saved successfully",

    // Support & Help Desk
    "support.title": "Help & Support Hub",
    "support.subtitle": "Frequently asked questions, ticket management, and 24×7 helpline",
    "support.myTickets": "My Support Tickets",
    "support.createTicket": "Submit New Ticket",
    "support.ticketNumber": "Ticket ID",
    "support.category": "Category",
    "support.subject": "Subject",
    "support.message": "Message / Details",
    "support.priority": "Priority",
    "support.reply": "Send Reply",
    "support.noTickets": "No support tickets submitted yet.",
    "support.faqTitle": "Frequently Asked Questions",
    "support.helpline": "24×7 Emergency Healthcare Helpline",

    // Dashboard & Home
    "home.welcome": "Welcome back",
    "home.upcomingAppointments": "Upcoming Appointments",
    "home.quickActions": "Quick Actions",
    "home.topSpecialists": "Featured Specialists",
    "home.nearbyHospitals": "Partner Hospitals",
    "home.healthSummary": "Health Summary",
    "home.noAppointments": "No upcoming appointments scheduled.",
  },

  hi: {
    // Navigation & Drawer
    "nav.home": "होम",
    "nav.findDoctors": "डॉक्टर ढूंढें",
    "nav.hospitals": "अस्पताल",
    "nav.appointments": "अपॉइंटमेंट्स",
    "nav.myAppointments": "मेरी अपॉइंटमेंट्स",
    "nav.consultOnline": "ऑनलाइन परामर्श",
    "nav.healthWallet": "डिजिटल हेल्थ वॉलेट",
    "nav.medicalRecords": "मेडिकल रिकॉर्ड्स",
    "nav.healthGoals": "स्वास्थ्य लक्ष्य",
    "nav.documentCenter": "दस्तावेज़ केंद्र",
    "nav.familyMembers": "परिवार के सदस्य",
    "nav.emergency": "आपातकालीन सहायता (SOS)",
    "nav.carePassport": "केयर पासपोर्ट",
    "nav.careContinuity": "केयर निरंतरता",
    "nav.commandCenter": "केयर कमांड सेंटर",
    "nav.careCommunity": "केयर कम्युनिटी",
    "nav.support": "सहायता और समर्थन",
    "nav.settings": "सेटिंग्स",
    "nav.favorites": "पसंदीदा डॉक्टर और अस्पताल",
    "nav.privacy": "गोपनीयता नीति",
    "nav.terms": "सेवा की शर्तें",

    // Common Buttons & Actions
    "btn.bookAppointment": "अपॉइंटमेंट बुक करें",
    "btn.reschedule": "रीशेड्यूल करें",
    "btn.cancelAppointment": "अपॉइंटमेंट रद्द करें",
    "btn.confirm": "पुष्टि करें",
    "btn.save": "बदलाव सहेजें",
    "btn.savePreferences": "प्राथमिकताएं सहेजें",
    "btn.submit": "सबमिट करें",
    "btn.search": "खोजें",
    "btn.filter": "फ़िल्टर",
    "btn.clear": "साफ़ करें",
    "btn.payNow": "अभी भुगतान करें",
    "btn.downloadPdf": "पीडीएफ डाउनलोड करें",
    "btn.share": "साझा करें",
    "btn.retry": "पुनः प्रयास करें",
    "btn.close": "बंद करें",
    "btn.back": "वापस",
    "btn.delete": "हटाएं",
    "btn.edit": "संपादित करें",
    "btn.add": "जोड़ें",
    "btn.logout": "लॉग आउट",
    "btn.viewAll": "सभी देखें",
    "btn.learnMore": "और जानें",

    // Status Badges
    "status.confirmed": "पुष्ट",
    "status.pending": "लंबित",
    "status.completed": "पूर्ण",
    "status.cancelled": "रद्द",
    "status.inProgress": "प्रगति में",
    "status.open": "खुला",
    "status.resolved": "हल हुआ",
    "status.closed": "बंद",
    "status.active": "सक्रिय",
    "status.inactive": "निष्क्रिय",

    // Offline & Connectivity
    "offline.bannerTitle": "आप वर्तमान में ऑफ़लाइन हैं",
    "offline.bannerSubtitle": "कैश किए गए मेडिकल रिकॉर्ड देखे जा रहे हैं। बुकिंग और भुगतान के लिए इंटरनेट आवश्यक है।",
    "offline.backOnline": "इंटरनेट कनेक्शन पुनः स्थापित हो गया। लाइव सिंक सक्रिय है।",
    "offline.actionBlocked": "अपॉइंटमेंट बुक करने या भुगतान करने के लिए इंटरनेट कनेक्शन आवश्यक है।",

    // Settings & Preferences
    "settings.title": "सेटिंग्स",
    "settings.language": "भाषा प्राथमिकता",
    "settings.languageDesc": "अपनी पसंदीदा ऐप भाषा चुनें",
    "settings.accessibility": "अभिगम्यता विकल्प (Accessibility)",
    "settings.accessibilityDesc": "कंट्रास्ट, फ़ॉन्ट का आकार और स्क्रीन रीडर सेटिंग्स समायोजित करें",
    "settings.highContrast": "उच्च कंट्रास्ट मोड",
    "settings.highContrastDesc": "पठन क्षमता और दृश्य सीमाओं को बेहतर बनाता है",
    "settings.fontSize": "टेक्स्ट का आकार",
    "settings.fontSizeNormal": "सामान्य",
    "settings.fontSizeLarge": "बड़ा",
    "settings.fontSizeXLarge": "अत्यधिक बड़ा",
    "settings.notifications": "सूचना प्राथमिकताएं",
    "settings.notifAppointments": "अपॉइंटमेंट रिमाइंडर",
    "settings.notifPrescriptions": "दवा पर्ची अपडेट",
    "settings.notifBilling": "बिलिंग और भुगतान",
    "settings.account": "खाता और सुरक्षा",
    "settings.changeEmail": "ईमेल पता बदलें",
    "settings.changePassword": "पासवर्ड बदलें",
    "settings.savedSuccess": "प्राथमिकताएं सफलतापूर्वक सहेजी गईं",

    // Support & Help Desk
    "support.title": "सहायता और सहायता केंद्र",
    "support.subtitle": "अक्सर पूछे जाने वाले प्रश्न, टिकट प्रबंधन और 24×7 हेल्पलाइन",
    "support.myTickets": "मेरी सहायता टिकटें",
    "support.createTicket": "नई टिकट बनाएं",
    "support.ticketNumber": "टिकट संख्या",
    "support.category": "श्रेणी",
    "support.subject": "विषय",
    "support.message": "संदेश / विवरण",
    "support.priority": "प्राथमिकता",
    "support.reply": "उत्तर भेजें",
    "support.noTickets": "अभी तक कोई सहायता टिकट नहीं बनाई गई है।",
    "support.faqTitle": "अक्सर पूछे जाने वाले प्रश्न",
    "support.helpline": "24×7 आपातकालीन स्वास्थ्य हेल्पलाइन",

    // Dashboard & Home
    "home.welcome": "स्वागत है",
    "home.upcomingAppointments": "आगामी अपॉइंटमेंट्स",
    "home.quickActions": "त्वरित क्रियाएं",
    "home.topSpecialists": "शीर्ष विशेषज्ञ",
    "home.nearbyHospitals": "सहयोगी अस्पताल",
    "home.healthSummary": "स्वास्थ्य सारांश",
    "home.noAppointments": "कोई आगामी अपॉइंटमेंट निर्धारित नहीं है।",
  },

  gu: {
    // Navigation & Drawer
    "nav.home": "હોમ",
    "nav.findDoctors": "ડૉક્ટર્સ શોધો",
    "nav.hospitals": "હોસ્પિટલો",
    "nav.appointments": "એપોઇન્ટમેન્ટ્સ",
    "nav.myAppointments": "મારી એપોઇન્ટમેન્ટ્સ",
    "nav.consultOnline": "ઓનલાઈન કન્સલ્ટેશન",
    "nav.healthWallet": "ડિજિટલ હેલ્થ વૉલેટ",
    "nav.medicalRecords": "તબીબી રેકોર્ડ્સ",
    "nav.healthGoals": "આરોગ્ય લક્ષ્યો",
    "nav.documentCenter": "દસ્તાવેજ કેન્દ્ર",
    "nav.familyMembers": "કુટુંબના સભ્યો",
    "nav.emergency": "કટોકટી સહાય (SOS)",
    "nav.carePassport": "કેર પાસપોર્ટ",
    "nav.careContinuity": "સંભાળ સાતત્ય",
    "nav.commandCenter": "કેર કમાન્ડ સેન્ટર",
    "nav.careCommunity": "કેર સમુદાય",
    "nav.support": "મદદ અને સહાય",
    "nav.settings": "સેટિંગ્સ",
    "nav.favorites": "મનપસંદ ડૉક્ટર્સ અને હોસ્પિટલો",
    "nav.privacy": "ગોપનીયતા નીતિ",
    "nav.terms": "સેવાની શરતો",

    // Common Buttons & Actions
    "btn.bookAppointment": "એપોઇન્ટમેન્ટ બુક કરો",
    "btn.reschedule": "સમય બદલો",
    "btn.cancelAppointment": "એપોઇન્ટમેન્ટ રદ કરો",
    "btn.confirm": "પુષ્ટિ કરો",
    "btn.save": "ફેરફારો સાચવો",
    "btn.savePreferences": "પસંદગીઓ સાચવો",
    "btn.submit": "સબમિટ કરો",
    "btn.search": "શોધો",
    "btn.filter": "ફિલ્ટર",
    "btn.clear": "સાફ કરો",
    "btn.payNow": "અત્યારે ચૂકવો",
    "btn.downloadPdf": "પીડીએફ ડાઉનલોડ કરો",
    "btn.share": "શેર કરો",
    "btn.retry": "ફરી પ્રયાસ કરો",
    "btn.close": "બંધ કરો",
    "btn.back": "પાછા",
    "btn.delete": "કાઢી નાખો",
    "btn.edit": "સંપાદિત કરો",
    "btn.add": "ઉમેરો",
    "btn.logout": "લૉગ આઉટ",
    "btn.viewAll": "બધા જુઓ",
    "btn.learnMore": "વધુ જાણો",

    // Status Badges
    "status.confirmed": "પુષ્ટિ થયેલ",
    "status.pending": "બાકી",
    "status.completed": "પૂર્ણ",
    "status.cancelled": "રદ કરેલ",
    "status.inProgress": "પ્રગતિમાં",
    "status.open": "ખુલ્લું",
    "status.resolved": "ઉકેલાયેલ",
    "status.closed": "બંધ",
    "status.active": "સક્રિય",
    "status.inactive": "નિષ્ક્રિય",

    // Offline & Connectivity
    "offline.bannerTitle": "તમે હાલમાં ઑફલાઇન છો",
    "offline.bannerSubtitle": "સંગ્રહિત મેડિકલ રેકોર્ડ્સ જોઈ રહ્યા છો. બુકિંગ અને ચુકવણી માટે ઇન્ટરનેટ જરૂરી છે.",
    "offline.backOnline": "ઇન્ટરનેટ કનેક્શન પુનઃસ્થાપિત થયું. લાઇવ સિંક સક્રિય છે.",
    "offline.actionBlocked": "એપોઇન્ટમેન્ટ બુક કરવા અથવા ચુકવણી કરવા માટે ઇન્ટરનેટ કનેક્શન જરૂરી છે.",

    // Settings & Preferences
    "settings.title": "સેટિંગ્સ",
    "settings.language": "ભાષા પસંદગી",
    "settings.languageDesc": "તમારી પસંદગીની એપ્લિકેશન ભાષા પસંદ કરો",
    "settings.accessibility": "ઍક્સેસિબિલિટી વિકલ્પો (Accessibility)",
    "settings.accessibilityDesc": "કોન્ટ્રાસ્ટ, ફોન્ટ કદ અને સ્ક્રીન રીડર સેટિંગ્સ વ્યવસ્થિત કરો",
    "settings.highContrast": "હાઈ કોન્ટ્રાસ્ટ મોડ",
    "settings.highContrastDesc": "વાંચન ક્ષમતા અને વિઝ્યુઅલ બોર્ડર્સમાં સુધારો કરે છે",
    "settings.fontSize": "ટેક્સ્ટનું કદ",
    "settings.fontSizeNormal": "સામાન્ય",
    "settings.fontSizeLarge": "મોટું",
    "settings.fontSizeXLarge": "ઘણું મોટું",
    "settings.notifications": "સૂચના પસંદગીઓ",
    "settings.notifAppointments": "એપોઇન્ટમેન્ટ રિમાઇન્ડર્સ",
    "settings.notifPrescriptions": "દવા પ્રિસ્ક્રિપ્શન અપડેટ્સ",
    "settings.notifBilling": "બિલિંગ અને ચુકવણીઓ",
    "settings.account": "એકાઉન્ટ અને સુરક્ષા",
    "settings.changeEmail": "ઇમેઇલ સરનામું બદલો",
    "settings.changePassword": "પાસવર્ડ બદલો",
    "settings.savedSuccess": "પસંદગીઓ સફળતાપૂર્વક સાચવવામાં આવી",

    // Support & Help Desk
    "support.title": "મદદ અને સપોર્ટ કેન્દ્ર",
    "support.subtitle": "વારંવાર પૂછાતા પ્રશ્નો, ટિકિટ મેનેજમેન્ટ અને 24×7 હેલ્પલાઇન",
    "support.myTickets": "મારી સપોર્ટ ટિકિટ્સ",
    "support.createTicket": "નવી ટિકિટ બનાવો",
    "support.ticketNumber": "ટિકિટ નંબર",
    "support.category": "શ્રેણી",
    "support.subject": "વિષય",
    "support.message": "સંદેશ / વિગતો",
    "support.priority": "પ્રાધાન્યતા",
    "support.reply": "જવાબ મોકલો",
    "support.noTickets": "હજુ સુધી કોઈ સપોર્ટ ટિકિટ સબમિટ કરવામાં આવી નથી.",
    "support.faqTitle": "વારંવાર પૂછાતા પ્રશ્નો",
    "support.helpline": "24×7 કટોકટી આરોગ્ય હેલ્પલાઇન",

    // Dashboard & Home
    "home.welcome": "સ્વાગત છે",
    "home.upcomingAppointments": "આગામી એપોઇન્ટમેન્ટ્સ",
    "home.quickActions": "ઝડપી ક્રિયાઓ",
    "home.topSpecialists": "ટોચના નિષ્ણાતો",
    "home.nearbyHospitals": "ભાગીદાર હોસ્પિટલો",
    "home.healthSummary": "આરોગ્ય સારાંશ",
    "home.noAppointments": "કોઈ આગામી એપોઇન્ટમેન્ટ શેડ્યૂલ નથી.",
  },
};

let currentLanguage: Language = "en";

export const getLanguage = (): Language => currentLanguage;

export const setLanguage = (lang: Language): void => {
  if (lang === "en" || lang === "hi" || lang === "gu") {
    currentLanguage = lang;
  }
};

/**
 * Translate a key into the active language, falling back to English, then defaultText or the key.
 */
export const t = (key: string, defaultText?: string, langOverride?: Language): string => {
  const lang = langOverride || currentLanguage;
  const langDict = translations[lang] || translations.en;
  if (langDict && langDict[key]) {
    return langDict[key];
  }
  const enDict = translations.en;
  if (enDict && enDict[key]) {
    return enDict[key];
  }
  return defaultText || key;
};

