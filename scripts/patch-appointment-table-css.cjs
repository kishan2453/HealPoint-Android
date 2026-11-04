const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../HealPointDoctorWeb/src/DoctorSaaSMaster.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newCSS = `

/* =============================================================================
   12. APPOINTMENT COMMAND CENTER, ID CHIPS & COMPACT EMPTY STATES
   ============================================================================= */
.dp-id-chip {
  display: inline-flex !important;
  align-items: center !important;
  padding: 4px 8px !important;
  border-radius: 6px !important;
  background: #f1f5f9 !important;
  color: #334155 !important;
  font-family: monospace !important;
  font-size: 0.8rem !important;
  font-weight: 750 !important;
  letter-spacing: 0.05em !important;
  border: 1px solid #cbd5e1 !important;
}

.dp-empty-appointment-state {
  display: flex !important;
  align-items: center !important;
  gap: 20px !important;
  padding: 32px 28px !important;
  background: #f8fafc !important;
  border: 1.5px dashed #cbd5e1 !important;
  border-radius: 14px !important;
  margin: 16px 0 !important;
  text-align: left !important;
}

@media (max-width: 680px) {
  .dp-empty-appointment-state {
    flex-direction: column !important;
    text-align: center !important;
    padding: 24px 16px !important;
  }
}

.dp-empty-appointment-icon {
  width: 54px !important;
  height: 54px !important;
  min-width: 54px !important;
  border-radius: 14px !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.6rem !important;
}

.dp-empty-appointment-content {
  flex: 1 1 auto !important;
}

.dp-empty-appointment-content h4 {
  font-size: 1.05rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  margin: 0 0 6px 0 !important;
}

.dp-empty-appointment-content p {
  font-size: 0.88rem !important;
  color: #64748b !important;
  margin: 0 0 14px 0 !important;
  line-height: 1.5 !important;
}

.dp-empty-appointment-actions {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
`;

fs.writeFileSync(cssPath, css + newCSS, 'utf8');
console.log('Appended Appointment empty states and ID chips CSS to DoctorSaaSMaster.css');

