const fs = require("fs");
const path = require("path");

const bookingPath = path.join(__dirname, "../app/booking/[doctorId].tsx");
let content = fs.readFileSync(bookingPath, "utf8");

if (!content.includes("isDeviceOnline")) {
  content = 'import { isDeviceOnline } from "@/hooks/use-network";\nimport { t } from "@/lib/i18n";\n' + content;

  const target = "setSubmitting(true);\n    try {\n      const res = await appointmentService.bookAppointment({";
  const replacement = `if (!isDeviceOnline()) {
      Alert.alert(
        t("offline.bannerTitle", "Offline Mode"),
        t("offline.actionBlocked", "Internet connection required to book appointments or process payments."),
        [{ text: t("btn.close", "OK") }]
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await appointmentService.bookAppointment({`;

  content = content.replace(target, replacement);
  fs.writeFileSync(bookingPath, content, "utf8");
  console.log("Successfully added offline guard to app/booking/[doctorId].tsx");
} else {
  console.log("isDeviceOnline already present in booking");
}
