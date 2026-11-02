import taskModel from "../models/taskModel.js";

export const getTasks = async (req, res) => {
  try {
    const {
      hospitalId,
      department,
      priority,
      status,
      assignedToId,
      overdueOnly,
      limit = 100,
    } = req.query;

    const query = {};
    const targetHospital = hospitalId || req.user?.hospitalId;
    if (targetHospital) {
      query.$or = [{ hospitalId: targetHospital }, { hospitalId: null }];
    }

    if (department) query.department = department;
    if (priority) query.priority = priority;
    if (status) query.status = status;
    if (assignedToId) query["assignedTo.id"] = assignedToId;

    if (overdueOnly === "true") {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: ["Completed", "Cancelled"] };
    }

    const tasks = await taskModel.find(query).sort({ dueDate: 1 }).limit(Number(limit));
    return res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      priority,
      assignedTo,
      dueDate,
      hospitalId,
      relatedEntityType,
      relatedEntityId,
    } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ success: false, message: "Title and dueDate are required." });
    }

    const task = await taskModel.create({
      hospitalId: hospitalId || req.user?.hospitalId || null,
      title,
      description: description || "",
      department: department || "Operations",
      priority: priority || "medium",
      status: assignedTo?.id ? "Assigned" : "New",
      assignedTo: assignedTo || { id: "", name: "Unassigned", role: "unassigned" },
      assignedBy: {
        id: req.user?._id?.toString() || req.user?.id || "admin",
        name: req.user?.name || "Administrator",
        role: req.user?.role || "admin",
      },
      dueDate: new Date(dueDate),
      relatedEntityType: relatedEntityType || "general",
      relatedEntityId: relatedEntityId || "",
    });

    return res.status(201).json({ success: true, task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completionNotes } = req.body;

    const validStatuses = [
      "New",
      "Assigned",
      "In Progress",
      "Under Review",
      "Completed",
      "Cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid task status." });
    }

    const updateFields = { status };
    if (status === "Completed") {
      updateFields.completedAt = new Date();
      if (completionNotes) updateFields.completionNotes = completionNotes;
    }

    const task = await taskModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.status(200).json({ success: true, task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo || !assignedTo.id || !assignedTo.name) {
      return res.status(400).json({ success: false, message: "Valid assignedTo object required." });
    }

    const task = await taskModel.findByIdAndUpdate(
      id,
      {
        $set: {
          assignedTo,
          status: "Assigned",
          assignedBy: {
            id: req.user?._id?.toString() || req.user?.id || "admin",
            name: req.user?.name || "Administrator",
            role: req.user?.role || "admin",
          },
        },
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.status(200).json({ success: true, task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addTaskComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Comment text cannot be empty." });
    }

    const comment = {
      authorId: req.user?._id?.toString() || req.user?.id || "user",
      authorName: req.user?.name || "Team Member",
      authorRole: req.user?.role || "staff",
      text: text.trim(),
      createdAt: new Date(),
    };

    const task = await taskModel.findByIdAndUpdate(
      id,
      { $push: { comments: comment } },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.status(200).json({ success: true, task, comment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaskWorkloadAnalytics = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};
    if (hospitalId) {
      query.$or = [{ hospitalId }, { hospitalId: null }];
    }

    const tasks = await taskModel.find(query).lean();
    const now = new Date();

    const stats = {
      total: tasks.length,
      new: 0,
      assigned: 0,
      inProgress: 0,
      underReview: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      departmentWorkload: {},
      priorityBreakdown: { low: 0, medium: 0, high: 0, urgent: 0 },
    };

    tasks.forEach((t) => {
      const s = (t.status || "New").toLowerCase();
      if (s === "new") stats.new++;
      else if (s === "assigned") stats.assigned++;
      else if (s === "in progress") stats.inProgress++;
      else if (s === "under review") stats.underReview++;
      else if (s === "completed") stats.completed++;
      else if (s === "cancelled") stats.cancelled++;

      if (t.dueDate && new Date(t.dueDate) < now && s !== "completed" && s !== "cancelled") {
        stats.overdue++;
      }

      const p = (t.priority || "medium").toLowerCase();
      if (stats.priorityBreakdown[p] !== undefined) {
        stats.priorityBreakdown[p]++;
      }

      const dept = t.department || "Operations";
      if (!stats.departmentWorkload[dept]) {
        stats.departmentWorkload[dept] = { total: 0, pending: 0, completed: 0 };
      }
      stats.departmentWorkload[dept].total++;
      if (s === "completed") {
        stats.departmentWorkload[dept].completed++;
      } else if (s !== "cancelled") {
        stats.departmentWorkload[dept].pending++;
      }
    });

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
