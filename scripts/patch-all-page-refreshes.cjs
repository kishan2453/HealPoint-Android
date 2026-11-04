const fs = require('fs');
const path = require('path');

const doctorPortalPath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let content = fs.readFileSync(doctorPortalPath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. AppointmentsView refresh button feedback
content = content.replace(
  `            onClick={() => {\n              fetchAppointments();\n              if (onRefresh) onRefresh();\n            }}`,
  `            onClick={async () => {\n              await fetchAppointments();\n              if (onRefresh) onRefresh();\n              toast.success("Appointments updated");\n            }}`
);

// 2. PatientQueueView fetchQueue feedback
content = content.replace(
  `          <button\n            type="button"\n            className="dp-queue-refresh-btn"\n            onClick={fetchQueue}\n            title="Refresh queue"\n            disabled={loading}\n          >`,
  `          <button\n            type="button"\n            className="dp-queue-refresh-btn"\n            onClick={async () => {\n              await fetchQueue();\n              toast.success("OPD Queue refreshed");\n            }}\n            title="Refresh queue"\n            disabled={loading}\n          >`
);

// 3. AvailabilityView loadCalendar feedback
content = content.replace(
  `              <button\n                type="button"\n                className="dp-light-btn"\n                style={{ padding: "6px 12px" }}\n                onClick={loadCalendar}\n                disabled={loading}\n                title="Refresh Calendar"\n              >`,
  `              <button\n                type="button"\n                className="dp-light-btn"\n                style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}\n                onClick={async () => {\n                  await loadCalendar();\n                  toast.success("Calendar schedule refreshed");\n                }}\n                disabled={loading}\n                title="Refresh Calendar"\n              >`
);

// 4. EarningsView fetchEarnings feedback
content = content.replace(
  `            <button\n              type="button"\n              className="dp-btn dp-btn-outline"\n              onClick={fetchEarnings}`,
  `            <button\n              type="button"\n              className="dp-btn dp-btn-outline"\n              onClick={async () => {\n                await fetchEarnings();\n                toast.success("Earnings analytics refreshed");\n              }}`
);

// 5. ReviewsView fetchReviews feedback
content = content.replace(
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline"\n            onClick={fetchReviews}`,
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline"\n            onClick={async () => {\n              await fetchReviews();\n              toast.success("Patient reviews refreshed");\n            }}`
);

// 6. NotificationsView fetchNotifications feedback
content = content.replace(
  `            <button\n              type="button"\n              className="dp-btn dp-btn-outline"\n              onClick={fetchNotifications}`,
  `            <button\n              type="button"\n              className="dp-btn dp-btn-outline"\n              onClick={async () => {\n                await fetchNotifications();\n                toast.success("Notifications refreshed");\n              }}`
);

// 7. ProfileView onSaved feedback
content = content.replace(
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline dp-btn-sm"\n            onClick={() => {\n              if (onSaved) onSaved();\n            }}`,
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline dp-btn-sm"\n            onClick={async () => {\n              if (onSaved) await onSaved();\n              toast.success("Profile credentials reloaded");\n            }}`
);

// 8. VerificationView onSaved feedback
content = content.replace(
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline dp-btn-sm"\n            onClick={() => {\n              if (onSaved) onSaved();\n            }}\n            title="Refresh Verification Status from server"`,
  `          <button\n            type="button"\n            className="dp-btn dp-btn-outline dp-btn-sm"\n            onClick={async () => {\n              if (onSaved) await onSaved();\n              toast.success("Verification dossier reloaded");\n            }}\n            title="Refresh Verification Status from server"`
);

if (isCrlf) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(doctorPortalPath, content, 'utf8');
console.log("All page refresh toasts and async feedback wired successfully.");
