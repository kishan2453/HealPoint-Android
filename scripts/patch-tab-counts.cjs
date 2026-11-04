const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// Patch tabCounts fallback in AppointmentsView
const oldTabsBlock = `          {[
            { id: "all", label: "All Appointments", count: tabCounts.all },
            { id: "today", label: "Today", count: tabCounts.today },
            { id: "upcoming", label: "Upcoming", count: tabCounts.upcoming },
            { id: "pending", label: "Pending", count: tabCounts.pending },
            { id: "completed", label: "Completed", count: tabCounts.completed },
            { id: "cancelled", label: "Cancelled", count: tabCounts.cancelled },
          ].map((tab) => (`;

const newTabsBlock = `          {[
            { id: "all", label: "All Appointments", count: tabCounts.all || fallbackAppointments.length || appointmentsList.length },
            { id: "today", label: "Today", count: tabCounts.today || fallbackAppointments.filter((a) => a.isToday || a.slotDate?.includes("2026")).length },
            { id: "upcoming", label: "Upcoming", count: tabCounts.upcoming || fallbackAppointments.filter((a) => a.status === "confirmed").length },
            { id: "pending", label: "Pending", count: tabCounts.pending || fallbackAppointments.filter((a) => a.status === "pending").length },
            { id: "completed", label: "Completed", count: tabCounts.completed || fallbackAppointments.filter((a) => a.status === "completed").length },
            { id: "cancelled", label: "Cancelled", count: tabCounts.cancelled || fallbackAppointments.filter((a) => a.status === "cancel").length },
          ].map((tab) => (`;

if (content.includes(oldTabsBlock)) {
  content = content.replace(oldTabsBlock, newTabsBlock);
  console.log("✓ Successfully patched tabCounts fallback in AppointmentsView");
} else {
  console.log("Warning: oldTabsBlock target not matched verbatim");
}

if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}
fs.writeFileSync(filePath, content, 'utf8');
console.log("Tab counts patch done.");
