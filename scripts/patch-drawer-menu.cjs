const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../lib/drawer-menu.ts");
let content = fs.readFileSync(filePath, "utf8");

if (!content.includes('import { t } from "@/lib/i18n";')) {
  content = 'import { t } from "@/lib/i18n";\n' + content;

  // Replace labels in patientDrawerMenu
  content = content.replace('label: "Home"', 'label: t("nav.home", "Home")');
  content = content.replace('label: "Care Command Center"', 'label: t("nav.commandCenter", "Care Command Center")');
  content = content.replace('label: "Care Community"', 'label: t("nav.careCommunity", "Care Community")');
  content = content.replace('label: "Care Continuity"', 'label: t("nav.careContinuity", "Care Continuity")');
  content = content.replace('label: "Care Passport"', 'label: t("nav.carePassport", "Care Passport")');
  content = content.replace('label: "Consult Online"', 'label: t("nav.consultOnline", "Consult Online")');
  content = content.replace('label: "Digital Health Wallet"', 'label: t("nav.healthWallet", "Digital Health Wallet")');
  content = content.replace('label: "Emergency Help"', 'label: t("nav.emergency", "Emergency Help")');
  content = content.replace('label: "Family Members"', 'label: t("nav.familyMembers", "Family Members")');
  content = content.replace('label: "Find Doctors"', 'label: t("nav.findDoctors", "Find Doctors")');
  content = content.replace('label: "Health Document Center"', 'label: t("nav.documentCenter", "Health Document Center")');
  content = content.replace('label: "Health Goals"', 'label: t("nav.healthGoals", "Health Goals")');
  content = content.replace('label: "Help & Support"', 'label: t("nav.support", "Help & Support")');
  content = content.replace('label: "Hospitals"', 'label: t("nav.hospitals", "Hospitals")');
  content = content.replace('label: "Medical Records"', 'label: t("nav.medicalRecords", "Medical Records")');
  content = content.replace('label: "My Appointments"', 'label: t("nav.myAppointments", "My Appointments")');
  content = content.replace('label: "Saved Doctors & Hospitals"', 'label: t("nav.favorites", "Saved Doctors & Hospitals")');
  content = content.replace('label: "Settings"', 'label: t("nav.settings", "Settings")');

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Updated drawer-menu.ts with i18n translations");
} else {
  console.log("drawer-menu.ts already translated");
}
