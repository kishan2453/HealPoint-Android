const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'components', 'OnlineConsultations.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Add FaSyncAlt to imports
content = content.replace(
  '  FaVideo,\n} from "react-icons/fa";',
  '  FaVideo,\n  FaSyncAlt,\n} from "react-icons/fa";'
);

// 2. Add Refresh button beside Go Online button
const oldButton = `        <button
          type="button"
          className={\`btn \${online ? "btn-light" : "btn-primary"}\`}
          disabled={busyId === "__toggle__"}
          onClick={toggleOnline}
        >
          <FaVideo /> {online ? "Go Offline" : "Go Online"}
        </button>`;

const newButton = `        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-light"
            onClick={async () => {
              await load();
              toast.success("Online consultations reloaded");
            }}
            disabled={loading}
            title="Refresh consultations from server"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className={\`btn \${online ? "btn-light" : "btn-primary"}\`}
            disabled={busyId === "__toggle__"}
            onClick={toggleOnline}
          >
            <FaVideo /> {online ? "Go Offline" : "Go Online"}
          </button>
        </div>`;

if (content.includes(oldButton)) {
  content = content.replace(oldButton, newButton);
  console.log("✓ Added Refresh button to OnlineConsultations.jsx");
} else {
  console.log("Warning: oldButton not matched in OnlineConsultations.jsx");
}

if (isCrlf) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log("OnlineConsultations patch done.");

