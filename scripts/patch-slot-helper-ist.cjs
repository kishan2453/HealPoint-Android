const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointBackend', 'helpers', 'slotHelper.js');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const target = `  // If booking for today, exclude slots that have already passed
  const now = new Date();
  const isToday =
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();`;

const replacement = `  // If booking for today, exclude slots that have already passed in Asia/Kolkata (IST)
  const nowIST = new Date();
  const istDateStr = nowIST.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  const [nowD, nowM, nowY] = istDateStr.split("/").map(Number);
  const istTimeStr = nowIST.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [istH, istMin] = istTimeStr.split(":").map(Number);
  const currentTotalMinutes = istH * 60 + istMin;

  const isToday =
    parsedDate.getDate() === nowD &&
    parsedDate.getMonth() + 1 === nowM &&
    parsedDate.getFullYear() === nowY;

  const targetDateMid = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
  const todayMid = new Date(nowY, nowM - 1, nowD, 0, 0, 0);
  if (targetDateMid.getTime() < todayMid.getTime()) {
    return {
      availableSlots: [],
      reason: "Cannot book appointments for past dates",
      hourlyCapacity: {},
    };
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Successfully patched slotHelper.js with strict Asia/Kolkata date & slot time logic');
} else {
  console.error('Target not matched in slotHelper.js');
  process.exit(1);
}
