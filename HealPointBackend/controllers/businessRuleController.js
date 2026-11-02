import businessRuleModel from "../models/businessRuleModel.js";

const DEFAULT_RULES = [
  {
    category: "cancellation_policy",
    ruleCode: "CANCELLATION_MIN_HOURS",
    name: "Minimum Cancellation Notice",
    description: "Requires patients to cancel at least N hours before appointment time.",
    config: { minHoursNotice: 2, allowAutoRefund: true },
    isActive: true,
    priority: 10,
  },
  {
    category: "rescheduling_policy",
    ruleCode: "RESCHEDULE_MAX_LIMIT",
    name: "Maximum Rescheduling Count",
    description: "Limits how many times a patient can reschedule the same appointment.",
    config: { maxReschedules: 3, minAdvanceHours: 2 },
    isActive: true,
    priority: 10,
  },
  {
    category: "booking_limits",
    ruleCode: "MAX_ADVANCE_BOOKING_DAYS",
    name: "Maximum Advance Booking Window",
    description: "Determines how many days in advance an appointment can be booked.",
    config: { maxAdvanceDays: 90, maxDailyPerPatient: 3 },
    isActive: true,
    priority: 10,
  },
  {
    category: "queue_rules",
    ruleCode: "QUEUE_GRACE_PERIOD_MINS",
    name: "Queue Token Grace Period",
    description: "Grace period before marking an absent patient token as no-show.",
    config: { graceMinutes: 15, autoCallNext: true },
    isActive: true,
    priority: 10,
  },
  {
    category: "staff_scheduling",
    ruleCode: "MAX_CONSECUTIVE_SHIFTS",
    name: "Maximum Consecutive Shifts",
    description: "Prevents scheduling clinical staff for more than N consecutive shifts without rest.",
    config: { maxConsecutiveShifts: 2, minRestHours: 12 },
    isActive: true,
    priority: 10,
  },
];

export const getBusinessRules = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};
    if (hospitalId) {
      query.$or = [{ hospitalId }, { hospitalId: null }];
    }

    let rules = await businessRuleModel.find(query).sort({ priority: -1, createdAt: 1 });

    // Seed defaults if database is empty
    if (rules.length === 0) {
      const seeded = [];
      for (const def of DEFAULT_RULES) {
        const r = await businessRuleModel.create({
          ...def,
          hospitalId: hospitalId || null,
        });
        seeded.push(r);
      }
      rules = seeded;
    }

    return res.status(200).json({ success: true, count: rules.length, rules });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBusinessRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { config, name, description, priority, isActive, changeReason } = req.body;

    const existing = await businessRuleModel.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Business rule not found." });
    }

    // Save previous snapshot in history for rollback
    const historyEntry = {
      version: existing.version,
      config: existing.config,
      changedBy: req.user?.name || req.user?.email || "Admin",
      changedAt: new Date(),
      reason: changeReason || "Configuration updated",
    };

    existing.history.push(historyEntry);
    existing.version += 1;
    if (config !== undefined) existing.config = config;
    if (name) existing.name = name;
    if (description) existing.description = description;
    if (priority !== undefined) existing.priority = priority;
    if (isActive !== undefined) existing.isActive = isActive;

    await existing.save();

    return res.status(200).json({ success: true, rule: existing });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleBusinessRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await businessRuleModel.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Business rule not found." });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    return res.status(200).json({ success: true, rule });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const rollbackBusinessRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetVersion } = req.body;

    const rule = await businessRuleModel.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Business rule not found." });
    }

    const historical = rule.history.find((h) => h.version === Number(targetVersion));
    if (!historical) {
      return res.status(400).json({ success: false, message: "Specified historical version not found." });
    }

    // Record rollback event in history
    rule.history.push({
      version: rule.version,
      config: rule.config,
      changedBy: req.user?.name || "Admin",
      changedAt: new Date(),
      reason: `Rolled back to version ${targetVersion}`,
    });

    rule.config = historical.config;
    rule.version += 1;
    await rule.save();

    return res.status(200).json({ success: true, rule, message: `Successfully rolled back to version ${targetVersion}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Utility helper to evaluate a business rule server-side
 */
export const evaluateBusinessRule = async (ruleCode, hospitalId = null) => {
  try {
    const rule = await businessRuleModel.findOne({
      ruleCode,
      isActive: true,
      $or: [{ hospitalId }, { hospitalId: null }],
    }).sort({ hospitalId: -1, priority: -1 });

    return rule ? rule.config : null;
  } catch {
    return null;
  }
};
