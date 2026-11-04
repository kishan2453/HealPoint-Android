const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../HealPointDoctorWeb/src/DoctorSaaSMaster.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newCSS = `

/* =============================================================================
   10. BUTTON SYSTEM & PATIENT DIRECTORY SAAS POLISH
   ============================================================================= */
.dp-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  font-family: inherit !important;
  font-size: 0.88rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  border-radius: 8px !important;
  padding: 10px 18px !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  border: 1px solid transparent !important;
  box-sizing: border-box !important;
}

.dp-btn:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
}

.dp-btn-primary,
.dp-primary-btn {
  background: #2563eb !important;
  color: #ffffff !important;
  border-color: #2563eb !important;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2) !important;
}

.dp-btn-primary:hover,
.dp-primary-btn:hover {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
  transform: translateY(-1px) !important;
}

.dp-btn-outline {
  background: #ffffff !important;
  color: #2563eb !important;
  border: 1.5px solid #bfdbfe !important;
}

.dp-btn-outline:hover {
  background: #eff6ff !important;
  border-color: #2563eb !important;
  color: #1d4ed8 !important;
  transform: translateY(-1px) !important;
}

.dp-btn-secondary {
  background: #f1f5f9 !important;
  color: #334155 !important;
  border: 1px solid #cbd5e1 !important;
}

.dp-btn-secondary:hover {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}

.dp-btn-sm {
  padding: 6px 14px !important;
  font-size: 0.82rem !important;
  border-radius: 6px !important;
}

.dp-btn-danger,
.dp-btn-rose {
  background: #ef4444 !important;
  color: #ffffff !important;
  border-color: #ef4444 !important;
}

.dp-btn-danger:hover,
.dp-btn-rose:hover {
  background: #dc2626 !important;
}

.dp-btn-emerald,
.dp-btn-complete,
.dp-btn-accept {
  background: #10b981 !important;
  color: #ffffff !important;
  border-color: #10b981 !important;
}

.dp-btn-emerald:hover,
.dp-btn-complete:hover,
.dp-btn-accept:hover {
  background: #059669 !important;
}

.dp-btn-amber {
  background: #f59e0b !important;
  color: #ffffff !important;
  border-color: #f59e0b !important;
}

.dp-btn-full {
  width: 100% !important;
}

/* Patient Directory Table & Actions */
.dp-table-actions {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-wrap: wrap !important;
}

.dp-action-link {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 5px 10px !important;
  border-radius: 6px !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
  color: #2563eb !important;
  background: #eff6ff !important;
  border: 1px solid #dbeafe !important;
  text-decoration: none !important;
  transition: all 0.15s ease !important;
  white-space: nowrap !important;
}

.dp-action-link:hover {
  background: #2563eb !important;
  color: #ffffff !important;
  border-color: #2563eb !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 5px rgba(37, 99, 235, 0.25) !important;
}

.dp-table-patient-cell {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

.dp-table-patient-cell strong a {
  color: #172033 !important;
  text-decoration: none !important;
  font-weight: 700 !important;
  font-size: 0.92rem !important;
}

.dp-table-patient-cell strong a:hover {
  color: #2563eb !important;
}

.dp-id-sub {
  display: block !important;
  color: #64748b !important;
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  margin-top: 2px !important;
}

.dp-contact-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}

.dp-contact-col span {
  font-weight: 600 !important;
  color: #1e293b !important;
  font-size: 0.88rem !important;
}

.dp-contact-col small {
  color: #64748b !important;
  font-size: 0.78rem !important;
}

.dp-badge-stats {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-wrap: wrap !important;
}

.dp-badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  padding: 4px 10px !important;
  border-radius: 999px !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  border: 1px solid #bfdbfe !important;
}

.dp-badge-pill.green {
  background: #f0fdf4 !important;
  color: #16a34a !important;
  border-color: #bbf7d0 !important;
}

/* Verification Doc Chips */
.dp-doc-status-chip {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
}

.dp-doc-status-chip.ready {
  background: #dcfce7 !important;
  color: #15803d !important;
  border: 1px solid #86efac !important;
}

.dp-doc-status-chip.missing {
  background: #fef3c7 !important;
  color: #b45309 !important;
  border: 1px solid #fde68a !important;
}
`;

fs.writeFileSync(cssPath, css + newCSS, 'utf8');
console.log('Successfully appended button and table CSS to DoctorSaaSMaster.css');
