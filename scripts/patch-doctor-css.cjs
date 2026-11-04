const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'DoctorSaaSMaster.css');
let css = fs.readFileSync(cssPath, 'utf8');
const isCrlf = css.includes('\r\n');
css = css.replace(/\r\n/g, '\n');

// 1. Update Global Base & Shell Scrolling
const oldShellRule = `.dp-shell {
  display: flex !important;
  min-height: 100vh !important;
  background-color: #f8fafc !important;
  overflow-x: hidden !important;
  position: relative !important;
}`;

const newShellRule = `/* =============================================================================
   VERTICAL SCROLLING ENGINE & APP-SHELL ARCHITECTURE (FIX ALL PAGES)
   ============================================================================= */
html, body {
  height: 100% !important;
  min-height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background-color: #f8fafc !important;
}

#root {
  height: 100% !important;
  min-height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

.dp-shell {
  display: flex !important;
  height: 100vh !important;
  max-height: 100vh !important;
  min-height: 100vh !important;
  width: 100% !important;
  overflow: hidden !important;
  position: relative !important;
  background-color: #f8fafc !important;
}`;

if (css.includes(oldShellRule)) {
  css = css.replace(oldShellRule, newShellRule);
  console.log("✓ Updated .dp-shell with fixed 100vh layout engine");
} else {
  console.log("Warning: oldShellRule not matched");
}

// 2. Update .dp-main scrolling
const oldMainRule = `.dp-main {
  flex: 1 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  background: #f8fafc !important;
  padding: 0 clamp(20px, 3.5vw, 42px) 48px !important;
}`;

const newMainRule = `.dp-main {
  flex: 1 1 auto !important;
  height: 100vh !important;
  max-height: 100vh !important;
  min-height: 0 !important;
  min-width: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  scroll-behavior: smooth !important;
  display: flex !important;
  flex-direction: column !important;
  background: #f8fafc !important;
  padding: 0 clamp(20px, 3.5vw, 42px) 60px !important;
}

.dp-main::-webkit-scrollbar {
  width: 9px !important;
}

.dp-main::-webkit-scrollbar-track {
  background: #f8fafc !important;
}

.dp-main::-webkit-scrollbar-thumb {
  background: #cbd5e1 !important;
  border-radius: 999px !important;
  border: 2px solid #f8fafc !important;
}

.dp-main::-webkit-scrollbar-thumb:hover {
  background: #94a3b8 !important;
}`;

if (css.includes(oldMainRule)) {
  css = css.replace(oldMainRule, newMainRule);
  console.log("✓ Updated .dp-main with independent overflow-y: auto scrolling");
} else {
  console.log("Warning: oldMainRule not matched");
}

// 3. Append specific controls & search dropdown styles at the bottom
const additionalStyles = `

/* =============================================================================
   9. HEADER REFRESH BUTTON, SEARCH AUTOCOMPLETE & COLLAPSE TOGGLE
   ============================================================================= */
.dp-header-refresh-btn {
  background: #2563eb !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 999px !important;
  height: 38px !important;
  padding: 0 16px !important;
  font-weight: 750 !important;
  font-size: 0.85rem !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 7px !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.22) !important;
  flex-shrink: 0 !important;
}

.dp-header-refresh-btn:hover {
  background: #1d4ed8 !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.32) !important;
}

.dp-header-refresh-btn:disabled {
  opacity: 0.75 !important;
  cursor: not-allowed !important;
  transform: none !important;
}

/* Sidebar Logo & Collapse Toggle Redesign */
.dp-brand {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
  padding: 6px 6px 16px !important;
  border-bottom: 1.5px solid #e2e8f0 !important;
  margin-bottom: 12px !important;
  flex-shrink: 0 !important;
}

.dp-sidebar.is-collapsed .dp-brand {
  flex-direction: column !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 4px 0 14px !important;
}

.dp-collapse-btn {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #475569 !important;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  border-radius: 10px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06) !important;
}

.dp-collapse-btn:hover {
  background: #eff6ff !important;
  color: #2563eb !important;
  border-color: #60a5fa !important;
  transform: scale(1.05) !important;
  box-shadow: 0 3px 8px rgba(37, 99, 235, 0.18) !important;
}

.dp-collapse-btn svg {
  font-size: 14px !important;
}

/* Global Search Container & Live Dropdown */
.dp-global-search-container {
  position: relative !important;
  flex: 1 !important;
  max-width: 440px !important;
}

.dp-search-clear-btn {
  background: transparent !important;
  border: none !important;
  color: #94a3b8 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 4px !important;
  border-radius: 50% !important;
  transition: all 0.15s ease !important;
}

.dp-search-clear-btn:hover {
  color: #ef4444 !important;
  background: #fef2f2 !important;
}

.dp-search-results-dropdown {
  position: absolute !important;
  top: calc(100% + 8px) !important;
  left: 0 !important;
  right: 0 !important;
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14) !important;
  z-index: 1000 !important;
  overflow: hidden !important;
  max-height: 420px !important;
  overflow-y: auto !important;
  animation: dpSearchDrop 0.2s cubic-bezier(0.16, 1, 0.3, 1) both !important;
}

@keyframes dpSearchDrop {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dp-search-drop-group {
  border-bottom: 1px solid #f1f5f9 !important;
}

.dp-search-drop-group-title {
  padding: 8px 14px !important;
  font-size: 0.74rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.05em !important;
  color: #64748b !important;
  text-transform: uppercase !important;
  background: #f8fafc !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.dp-search-drop-item {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 10px 14px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  border-bottom: 1px solid #f8fafc !important;
}

.dp-search-drop-item:hover {
  background: #eff6ff !important;
}

.dp-search-drop-avatar {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #2563eb, #60a5fa) !important;
  color: #ffffff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 0.8rem !important;
  font-weight: 750 !important;
  flex-shrink: 0 !important;
}

.dp-search-drop-badge {
  padding: 3px 8px !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  border-radius: 6px !important;
  font-size: 0.75rem !important;
  font-weight: 750 !important;
  flex-shrink: 0 !important;
}

.dp-search-drop-info {
  flex: 1 !important;
  min-width: 0 !important;
}

.dp-search-drop-info strong {
  display: block !important;
  font-size: 0.88rem !important;
  color: #172033 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.dp-search-drop-info small {
  display: block !important;
  font-size: 0.74rem !important;
  color: #64748b !important;
}

.dp-search-drop-arrow {
  font-size: 0.8rem !important;
  color: #94a3b8 !important;
  transition: transform 0.15s ease !important;
}

.dp-search-drop-item:hover .dp-search-drop-arrow {
  color: #2563eb !important;
  transform: translateX(3px) !important;
}

.dp-search-drop-footer {
  padding: 10px 14px !important;
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  color: #2563eb !important;
  background: #f8fafc !important;
  text-align: center !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}

.dp-search-drop-footer:hover {
  background: #eff6ff !important;
}

.dp-search-empty-drop {
  padding: 24px 18px !important;
  text-align: center !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 8px !important;
}

.dp-search-empty-drop p {
  font-size: 0.85rem !important;
  color: #64748b !important;
  margin: 0 !important;
}

/* Schedule Snapshot Row Fix (Clean Flexbox instead of broken 5-column grid) */
.dp-schedule-snapshot {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}

.dp-schedule-snapshot .dp-schedule-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 11px 16px !important;
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  margin: 0 !important;
}

.dp-schedule-snapshot .dp-schedule-row span {
  font-size: 0.85rem !important;
  color: #64748b !important;
  font-weight: 600 !important;
}

.dp-schedule-snapshot .dp-schedule-row strong {
  font-size: 0.88rem !important;
  color: #172033 !important;
  font-weight: 750 !important;
  text-align: right !important;
}
`;

css += additionalStyles;

if (isCrlf) css = css.replace(/\n/g, '\r\n');
fs.writeFileSync(cssPath, css, 'utf8');
console.log("DoctorSaaSMaster.css enhancements applied successfully.");
