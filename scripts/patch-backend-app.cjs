const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'HealPointBackend', 'app.js');
let content = fs.readFileSync(appPath, 'utf8');

// Add imports
const importTarget = `import hospitalSubscriptionRoutes from "./routes/hospitalSubscriptionRoutes.js";`;
const newImports = `import hospitalSubscriptionRoutes from "./routes/hospitalSubscriptionRoutes.js";
// [Part 19] Workflow Automation & Operations Imports
import workflowRoutes from "./routes/workflowRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import aiAssistantRoutes from "./routes/aiAssistantRoutes.js";
import businessRuleRoutes from "./routes/businessRuleRoutes.js";
import advancedSupportRoutes from "./routes/advancedSupportRoutes.js";
import reportBuilderRoutes from "./routes/reportBuilderRoutes.js";
import internalAlertRoutes from "./routes/internalAlertRoutes.js";
import globalSearchRoutes from "./routes/globalSearchRoutes.js";
import importExportRoutes from "./routes/importExportRoutes.js";
import systemConfigRoutes from "./routes/systemConfigRoutes.js";`;

content = content.replace(importTarget, newImports);

// Mount routes
const mountTarget = `app.use("/api/v1/hospital-subscriptions", hospitalSubscriptionRoutes);`;
const newMounts = `app.use("/api/v1/hospital-subscriptions", hospitalSubscriptionRoutes);
// [Part 19] AI-Powered Hospital Operations & Intelligent Workflow Automation
app.use("/api/v1/workflows", workflowRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/ai-assistant", aiAssistantRoutes);
app.use("/api/v1/business-rules", businessRuleRoutes);
app.use("/api/v1/advanced-support", advancedSupportRoutes);
app.use("/api/v1/report-builder", reportBuilderRoutes);
app.use("/api/v1/internal-alerts", internalAlertRoutes);
app.use("/api/v1/global-search", globalSearchRoutes);
app.use("/api/v1/import-export", importExportRoutes);
app.use("/api/v1/system-config", systemConfigRoutes);`;

content = content.replace(mountTarget, newMounts);

fs.writeFileSync(appPath, content, 'utf8');
console.log('Successfully patched HealPointBackend/app.js with Part 19 routes');
