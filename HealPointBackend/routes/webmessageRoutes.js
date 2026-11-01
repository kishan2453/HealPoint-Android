import express from "express";
import mongoose from "mongoose";
import { authenticate } from "../middlewares/authMiddlewares.js";
import SupportTicket from "../models/supportTicketModel.js";

const router = express.Router();

const getWebMessagesCollection = () => mongoose.connection.db.collection("webmessages");

// POST /api/v1/webmessage/create or /api/v1/webmessage
router.post(["/create", "/"], async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const { name, email, phone, subject, message, category, priority, hospitalId } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required." });
    }

    const doc = {
      name: name || "HealPoint User",
      email: email || "",
      phone: phone || "",
      subject,
      message,
      category: category || "General Inquiry",
      priority: priority || "Medium",
      status: "Open",
      hospitalId: hospitalId && mongoose.Types.ObjectId.isValid(hospitalId) ? new mongoose.Types.ObjectId(hospitalId) : undefined,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await col.insertOne(doc);

    // Also mirror to SupportTicket for unified customer service desk
    try {
      const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
      await SupportTicket.create({
        ticketNumber,
        subject,
        body: message,
        category: "GENERAL_ENQUIRY",
        status: "OPEN",
        priority: priority === "Urgent" ? "CRITICAL" : "MEDIUM",
        patientName: name || "HealPoint User",
        patientEmail: email || "",
        patientPhone: phone || "",
        hospitalId: doc.hospitalId,
        messages: [{
          sender: { name: name || "HealPoint User", role: "patient" },
          body: message,
          sentAt: new Date(),
        }],
        timeline: [{
          event: "TICKET_CREATED",
          note: "Created via Web Message / Hospital Admin portal",
          timestamp: new Date(),
        }],
      });
    } catch {
      // Non-blocking mirror
    }

    res.status(201).json({
      success: true,
      message: "Message submitted successfully",
      id: result.insertedId,
      webMessage: { ...doc, _id: result.insertedId },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/webmessage/get-all
router.get("/get-all", authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const { search, status, priority, hospitalId } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;
    if (hospitalId && mongoose.Types.ObjectId.isValid(hospitalId)) {
      query.hospitalId = new mongoose.Types.ObjectId(hospitalId);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const messages = await col.find(query).sort({ createdAt: -1 }).toArray();

    const [total, open, inProgress, resolved, closed, unread] = await Promise.all([
      col.countDocuments(query),
      col.countDocuments({ ...query, status: "Open" }),
      col.countDocuments({ ...query, status: "In Progress" }),
      col.countDocuments({ ...query, status: "Resolved" }),
      col.countDocuments({ ...query, status: "Closed" }),
      col.countDocuments({ ...query, isRead: { $ne: true } }),
    ]);

    res.status(200).json({
      success: true,
      count: messages.length,
      webMessages: messages,
      messages,
      counts: { total, open, inProgress, resolved, closed, unread },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/webmessage/read/:id
router.patch(["/read/:id"], authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const id = req.params.id;
    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { _id: id };
    await col.updateOne(filter, { $set: { isRead: true, updatedAt: new Date() } });
    res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/webmessage/reply/:id
router.patch(["/reply/:id", "/replay/:id"], authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const id = req.params.id;
    const { reply, replyText, status, priority } = req.body;
    const finalReply = replyText || reply || "";
    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { _id: id };
    const update = {
      reply: finalReply,
      adminReply: finalReply,
      repliedAt: new Date(),
      status: status || "Resolved",
      updatedAt: new Date(),
    };
    if (priority) update.priority = priority;

    await col.updateOne(filter, { $set: update });
    const updated = await col.findOne(filter);
    res.status(200).json({ success: true, message: "Reply sent successfully", webMessage: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/webmessage/status/:id
router.patch(["/status/:id"], authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const id = req.params.id;
    const { status } = req.body;
    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { _id: id };
    await col.updateOne(filter, { $set: { status, updatedAt: new Date() } });
    const updated = await col.findOne(filter);
    res.status(200).json({ success: true, message: "Status updated successfully", webMessage: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/v1/webmessage/delete/:id or /api/v1/webmessage/:id
router.delete(["/delete/:id", "/:id"], authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const id = req.params.id;
    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { _id: id };
    await col.deleteOne(filter);
    res.status(200).json({ success: true, message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
