import express from "express";
import mongoose from "mongoose";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

const getWebMessagesCollection = () => mongoose.connection.db.collection("webmessages");

// GET /api/v1/webmessage/get-all
router.get("/get-all", authenticate, async (req, res) => {
  try {
    const col = getWebMessagesCollection();
    const { search, status, priority } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;
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
      col.countDocuments({}),
      col.countDocuments({ status: "Open" }),
      col.countDocuments({ status: "In Progress" }),
      col.countDocuments({ status: "Resolved" }),
      col.countDocuments({ status: "Closed" }),
      col.countDocuments({ isRead: { $ne: true } }),
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
