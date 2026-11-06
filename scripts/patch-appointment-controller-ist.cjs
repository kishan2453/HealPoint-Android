const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointBackend', 'controllers', 'appointmentController.js');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const target = `    if (!doctor.isActive || doctor.available === false) {
      return res.status(400).json({
        success: false,
        message: "This doctor is currently not accepting appointments",
      });
    }`;

const replacement = `    if (!doctor.isActive || doctor.available === false) {
      return res.status(400).json({
        success: false,
        message: "This doctor is currently not accepting appointments",
      });
    }

    // Strict Asia/Kolkata (IST) past-date and past-slot validation
    const nowIST = new Date();
    const istDateParts = nowIST.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).split("/").map(Number);
    const todayMid = new Date(istDateParts[2], istDateParts[1] - 1, istDateParts[0], 0, 0, 0);
    const parsedTarget = parseDateString(slotDate);
    if (!parsedTarget) {
      return res.status(400).json({ success: false, message: "Invalid slot date format" });
    }
    const targetMid = new Date(parsedTarget.getFullYear(), parsedTarget.getMonth(), parsedTarget.getDate(), 0, 0, 0);
    if (targetMid.getTime() < todayMid.getTime()) {
      return res.status(400).json({
        success: false,
        code: "PAST_DATE_NOT_ALLOWED",
        message: "Cannot book appointments for past dates. Please select today or a future date.",
      });
    }

    if (targetMid.getTime() === todayMid.getTime()) {
      const istTimeStr = nowIST.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const [nowH, nowMin] = istTimeStr.split(":").map(Number);
      const currentMin = nowH * 60 + nowMin;

      const parseSlotToMinutes = (slot) => {
        const match = String(slot).trim().match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)?$/i);
        if (!match) return 0;
        let h = Number(match[1]);
        const m = Number(match[2]);
        const meridiem = (match[3] || "").toUpperCase();
        if (meridiem === "PM" && h !== 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        return h * 60 + m;
      };

      const slotMin = parseSlotToMinutes(slotTime);
      if (slotMin <= currentMin) {
        return res.status(400).json({
          success: false,
          code: "PAST_SLOT_NOT_ALLOWED",
          message: "Selected time slot has already passed for today. Please choose a future slot or date.",
        });
      }
    }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Successfully patched appointmentController.js with strict IST past date & slot validation');
} else {
  console.error('Target not matched in appointmentController.js');
  process.exit(1);
}
