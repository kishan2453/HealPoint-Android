const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../HealPointDoctorWeb/src/DoctorSaaSMaster.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newCSS = `

/* =============================================================================
   11. ENTERPRISE DASHBOARD REBUILD & SCROLLING ENHANCEMENTS
   ============================================================================= */

/* Main scrollable viewport guarantee */
.dp-main {
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
  padding: 0 clamp(20px, 3.5vw, 42px) 140px !important;
}

/* Ensure table wrapper never traps vertical scrolling or clips rows */
.dp-table-wrapper {
  background: #ffffff !important;
  border: 1.5px solid #e2e8f0 !important;
  border-radius: 14px !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
  -webkit-overflow-scrolling: touch !important;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
  margin-bottom: 24px !important;
  width: 100% !important;
  max-width: 100% !important;
}

.dp-data-table {
  width: 100% !important;
  border-collapse: collapse !important;
  text-align: left !important;
}

.dp-data-table tbody tr {
  transition: background-color 0.15s ease !important;
}

.dp-data-table tbody tr:hover {
  background-color: #f8fafc !important;
}

/* Middle Section: Quick Action Command Grid (8 Enterprise Action Cards) */
.dp-command-hub {
  margin-bottom: 28px !important;
}

.dp-command-hub-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 14px !important;
}

.dp-command-hub-header h3 {
  font-size: 1.05rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.dp-command-grid {
  display: grid !important;
  grid-template-columns: repeat(4, 1fr) !important;
  gap: 16px !important;
}

@media (max-width: 1200px) {
  .dp-command-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 640px) {
  .dp-command-grid {
    grid-template-columns: 1fr !important;
  }
}

.dp-command-card {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  padding: 16px 18px !important;
  background: #ffffff !important;
  border: 1.5px solid #e2e8f0 !important;
  border-radius: 14px !important;
  text-decoration: none !important;
  color: #172033 !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important;
  position: relative !important;
  overflow: hidden !important;
}

.dp-command-card:hover {
  border-color: #2563eb !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.12) !important;
}

.dp-command-card-icon {
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  border-radius: 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.25rem !important;
  transition: all 0.2s ease !important;
}

.dp-command-card.blue .dp-command-card-icon {
  background: #eff6ff !important;
  color: #2563eb !important;
}

.dp-command-card.sky .dp-command-card-icon {
  background: #f0fdf4 !important;
  color: #059669 !important;
}

.dp-command-card.amber .dp-command-card-icon {
  background: #fffbeb !important;
  color: #d97706 !important;
}

.dp-command-card.indigo .dp-command-card-icon {
  background: #f5f3ff !important;
  color: #6366f1 !important;
}

.dp-command-card-info {
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.dp-command-card-title {
  display: block !important;
  font-size: 0.95rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  margin-bottom: 2px !important;
}

.dp-command-card-sub {
  display: block !important;
  font-size: 0.78rem !important;
  color: #64748b !important;
  line-height: 1.3 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.dp-command-card-arrow {
  color: #cbd5e1 !important;
  font-size: 0.85rem !important;
  transition: all 0.2s ease !important;
}

.dp-command-card:hover .dp-command-card-arrow {
  color: #2563eb !important;
  transform: translateX(3px) !important;
}

/* Clinical Lineup Cards inside Today's Command Center */
.dp-lineup-card {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 14px 18px !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 12px !important;
  margin-bottom: 10px !important;
  transition: all 0.15s ease !important;
}

.dp-lineup-card:hover {
  background: #f8fafc !important;
  border-color: #cbd5e1 !important;
}

.dp-lineup-time {
  padding: 6px 12px !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  border-radius: 8px !important;
  font-weight: 800 !important;
  font-size: 0.85rem !important;
  white-space: nowrap !important;
  text-align: center !important;
}

.dp-lineup-patient {
  flex: 1 1 auto !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

.dp-lineup-details strong {
  display: block !important;
  font-size: 0.95rem !important;
  color: #0f172a !important;
}

.dp-lineup-details small {
  color: #64748b !important;
  font-size: 0.8rem !important;
}

/* Analytics Summary Badges */
.dp-analytics-grid {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 12px !important;
  margin-bottom: 18px !important;
}

.dp-analytics-stat-card {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 14px !important;
}

.dp-analytics-stat-card small {
  display: block !important;
  color: #64748b !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  margin-bottom: 4px !important;
}

.dp-analytics-stat-card strong {
  font-size: 1.25rem !important;
  font-weight: 850 !important;
  color: #0f172a !important;
}
`;

fs.writeFileSync(cssPath, css + newCSS, 'utf8');
console.log('Appended Dashboard rebuild and scroll CSS to DoctorSaaSMaster.css');

