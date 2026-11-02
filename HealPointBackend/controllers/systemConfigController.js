import systemConfigModel from "../models/systemConfigModel.js";

const DEFAULT_CONFIGS = [
  {
    configKey: "SIMULATION_SAFETY",
    category: "simulation_safety",
    name: "Platform Simulation & Operational Safety",
    description: "Strict policy guaranteeing 100% simulated healthcare data and zero external emergency connectivity.",
    values: {
      enableRealSOS: false,
      enableExternalEmergencyDispatch: false,
      enableRealPaymentGateways: false,
      enforceStrictIsolation: true,
      simulationBannerMode: "subtle_operational",
    },
    isLocked: true, // Cannot be unlocked to ensure safety compliance
  },
  {
    configKey: "APPOINTMENT_POLICIES",
    category: "appointment_policies",
    name: "Hospital Appointment Scheduling Configuration",
    description: "Global defaults for booking window, max daily appointments, and cancellation cutoff.",
    values: {
      maxAdvanceBookingDays: 90,
      minCancellationNoticeHours: 2,
      maxRescheduleCount: 3,
      slotBufferMinutes: 5,
      autoReleaseUnconfirmedMinutes: 30,
    },
    isLocked: false,
  },
  {
    configKey: "PORTAL_FEATURE_FLAGS",
    category: "portals",
    name: "Multi-Portal Feature Flags",
    description: "Enables or disables operational modules across Patient, Doctor, Hospital Admin, and Super Admin.",
    values: {
      enableWorkflows: true,
      enableTaskManagement: true,
      enableAiAssistant: true,
      enableReportBuilder: true,
      enableDigitalQueue: true,
      enableStaffRoster: true,
      enableWaitlist: true,
    },
    isLocked: false,
  },
  {
    configKey: "WORKFLOW_SETTINGS",
    category: "workflows",
    name: "Automated Workflow Engine Defaults",
    description: "Maximum execution recursion depth, retry delays, and failure notification recipients.",
    values: {
      maxRecursionDepth: 3,
      defaultMaxRetries: 3,
      retryIntervalMinutes: 5,
      autoNotifyAdminsOnFailure: true,
    },
    isLocked: false,
  },
];

export const getSystemConfigs = async (req, res) => {
  try {
    let configs = await systemConfigModel.find().sort({ category: 1, createdAt: 1 });

    if (configs.length === 0) {
      const seeded = [];
      for (const def of DEFAULT_CONFIGS) {
        const c = await systemConfigModel.create(def);
        seeded.push(c);
      }
      configs = seeded;
    }

    return res.status(200).json({ success: true, count: configs.length, configs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSystemConfig = async (req, res) => {
  try {
    const { configKey } = req.params;
    const { values, reason } = req.body;

    const config = await systemConfigModel.findOne({ configKey });
    if (!config) {
      return res.status(404).json({ success: false, message: "System configuration not found." });
    }

    // Strict validation: NEVER allow enabling real SOS or live payments
    if (configKey === "SIMULATION_SAFETY" || config.category === "simulation_safety") {
      if (values.enableRealSOS === true || values.enableExternalEmergencyDispatch === true || values.enableRealPaymentGateways === true) {
        return res.status(403).json({
          success: false,
          message: "Safety Violation: Real SOS, emergency dispatch, and live payment processing are strictly forbidden on this platform.",
        });
      }
    }

    // Append audit log
    config.auditTrail.push({
      updatedBy: req.user?.name || req.user?.email || "Super Admin",
      updatedAt: new Date(),
      previousValues: config.values,
      reason: reason || "Administrative policy update",
    });

    config.values = { ...config.values, ...values };
    await config.save();

    return res.status(200).json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
