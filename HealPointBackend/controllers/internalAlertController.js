import internalAlertModel from "../models/internalAlertModel.js";

export const getInternalAlerts = async (req, res) => {
  try {
    const { hospitalId, severity, category, isResolved, limit = 100 } = req.query;
    const query = {};

    const targetHospital = hospitalId || req.user?.hospitalId;
    if (targetHospital) {
      query.$or = [{ hospitalId: targetHospital }, { hospitalId: null }];
    }

    if (severity) query.severity = severity;
    if (category) query.category = category;
    if (isResolved !== undefined) query.isResolved = isResolved === "true";

    const alerts = await internalAlertModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await internalAlertModel.countDocuments({
      ...query,
      isRead: false,
    });

    const criticalCount = await internalAlertModel.countDocuments({
      ...query,
      severity: "critical",
      isResolved: false,
    });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      unreadCount,
      criticalCount,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAlertRead = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await internalAlertModel.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found." });
    }
    return res.status(200).json({ success: true, alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllAlertsRead = async (req, res) => {
  try {
    const hospitalId = req.body.hospitalId || req.user?.hospitalId;
    const query = { isRead: false };
    if (hospitalId) {
      query.$or = [{ hospitalId }, { hospitalId: null }];
    }

    const result = await internalAlertModel.updateMany(query, { $set: { isRead: true } });
    return res.status(200).json({ success: true, updatedCount: result.modifiedCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const alert = await internalAlertModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: req.user?.name || "Admin",
          resolutionNotes: resolutionNotes || "Resolved via Operations Center",
        },
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found." });
    }

    return res.status(200).json({ success: true, alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createInternalAlert = async (req, res) => {
  try {
    const { title, message, severity, category, relatedEntityType, relatedEntityId, hospitalId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required." });
    }

    const alert = await internalAlertModel.create({
      hospitalId: hospitalId || req.user?.hospitalId || null,
      title,
      message,
      severity: severity || "info",
      category: category || "operations",
      source: "manual",
      relatedEntityType: relatedEntityType || "none",
      relatedEntityId: relatedEntityId || "",
    });

    return res.status(201).json({ success: true, alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
