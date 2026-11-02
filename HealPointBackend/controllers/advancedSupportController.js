import supportTicketModel from "../models/supportTicketModel.js";

export const getAdvancedSupportDashboard = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};
    if (hospitalId) {
      query.$or = [{ hospitalId }, { hospitalId: null }];
    }

    const tickets = await supportTicketModel.find(query).sort({ createdAt: -1 }).lean();

    const stats = {
      total: tickets.length,
      open: 0,
      inProgress: 0,
      escalated: 0,
      resolved: 0,
      closed: 0,
      byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
      byCategory: {},
      byTeam: {},
      averageResolutionHours: 0,
    };

    let totalResolutionTimeMs = 0;
    let resolvedWithTimes = 0;

    tickets.forEach((t) => {
      const s = (t.status || "OPEN").toUpperCase();
      if (s === "OPEN") stats.open++;
      else if (s === "IN_PROGRESS" || s === "ASSIGNED" || s === "TRIAGED") stats.inProgress++;
      else if (s === "ESCALATED") stats.escalated++;
      else if (s === "RESOLVED") stats.resolved++;
      else if (s === "CLOSED") stats.closed++;

      const p = (t.priority || "MEDIUM").toLowerCase();
      if (stats.byPriority[p] !== undefined) stats.byPriority[p]++;

      const cat = t.category || "GENERAL_ENQUIRY";
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      const team = t.team || "TIER_1_SUPPORT";
      stats.byTeam[team] = (stats.byTeam[team] || 0) + 1;

      if (t.resolvedAt && t.createdAt) {
        totalResolutionTimeMs += new Date(t.resolvedAt) - new Date(t.createdAt);
        resolvedWithTimes++;
      }
    });

    if (resolvedWithTimes > 0) {
      stats.averageResolutionHours = Number(
        (totalResolutionTimeMs / (resolvedWithTimes * 1000 * 60 * 60)).toFixed(1)
      );
    }

    return res.status(200).json({ success: true, stats, recentTickets: tickets.slice(0, 50) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId, assignedToName, assignedToRole, team } = req.body;

    const ticket = await supportTicketModel.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    ticket.assignedTo = {
      id: assignedToId || req.user?._id || req.user?.id,
      name: assignedToName || req.user?.name || "Support Staff",
      role: assignedToRole || req.user?.role || "support",
      team: team || ticket.team,
    };
    ticket.assignedAt = new Date();
    ticket.status = "ASSIGNED";

    ticket.timeline.push({
      event: "TICKET_ASSIGNED",
      note: `Ticket assigned to ${ticket.assignedTo.name} (${ticket.assignedTo.team})`,
      performedBy: {
        id: req.user?._id || req.user?.id,
        name: req.user?.name || "Admin",
        role: req.user?.role || "admin",
      },
      timestamp: new Date(),
    });

    await ticket.save();
    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const escalateSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, targetTeam = "ESCALATIONS_TEAM" } = req.body;

    const ticket = await supportTicketModel.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    ticket.status = "ESCALATED";
    ticket.priority = "HIGH";
    ticket.team = targetTeam;

    ticket.timeline.push({
      event: "TICKET_ESCALATED",
      note: reason || "Escalated to senior operations and management team.",
      performedBy: {
        id: req.user?._id || req.user?.id,
        name: req.user?.name || "Staff",
        role: req.user?.role || "staff",
      },
      timestamp: new Date(),
    });

    await ticket.save();
    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addInternalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { noteText } = req.body;

    if (!noteText || !noteText.trim()) {
      return res.status(400).json({ success: false, message: "Internal note body cannot be empty." });
    }

    const ticket = await supportTicketModel.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    const noteMessage = {
      sender: {
        id: req.user?._id || req.user?.id,
        name: req.user?.name || "Support Staff",
        role: req.user?.role || "staff",
      },
      body: noteText.trim(),
      isInternalNote: true,
      sentAt: new Date(),
    };

    ticket.messages.push(noteMessage);
    await ticket.save();

    return res.status(200).json({ success: true, ticket, noteMessage });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reopenSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const ticket = await supportTicketModel.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    ticket.status = "OPEN";
    ticket.resolvedAt = null;
    ticket.resolvedBy = null;

    ticket.timeline.push({
      event: "TICKET_REOPENED",
      note: reason || "Ticket reopened for further clarification or issue recurrence.",
      performedBy: {
        id: req.user?._id || req.user?.id,
        name: req.user?.name || "User",
        role: req.user?.role || "user",
      },
      timestamp: new Date(),
    });

    await ticket.save();
    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
