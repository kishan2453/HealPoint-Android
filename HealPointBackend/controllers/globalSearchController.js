import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import taskModel from "../models/taskModel.js";
import supportTicketModel from "../models/supportTicketModel.js";
import resourceModel from "../models/resourceModel.js";
import internalAlertModel from "../models/internalAlertModel.js";

export const globalSearch = async (req, res) => {
  try {
    const { query, category = "all", limit = 10 } = req.query;
    if (!query || query.trim().length < 2) {
      return res.status(200).json({ success: true, results: {}, total: 0 });
    }

    const q = query.trim();
    const regex = new RegExp(q, "i");
    const numLimit = Math.min(Number(limit) || 10, 20);
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;

    const results = {};
    let totalFound = 0;

    // 1. Doctors
    if (category === "all" || category === "doctors") {
      const docFilter = { $or: [{ name: regex }, { specialty: regex }, { email: regex }] };
      if (hospitalId) docFilter.hospitalId = hospitalId;
      const docs = await doctorModel.find(docFilter).select("name specialty hospitalId fees image available").limit(numLimit).lean();
      results.doctors = docs.map((d) => ({
        id: d._id,
        title: d.name,
        subtitle: d.specialty,
        category: "Doctor",
        route: `/doctors`,
        metadata: { fees: d.fees, available: d.available },
      }));
      totalFound += docs.length;
    }

    // 2. Appointments
    if (category === "all" || category === "appointments") {
      const apptFilter = { $or: [{ appointmentId: regex }, { patientName: regex }, { doctorName: regex }, { slotDate: regex }] };
      if (hospitalId) apptFilter.hospitalId = hospitalId;
      const appts = await appointmentModel.find(apptFilter).select("appointmentId patientName doctorName slotDate slotTime status amount").limit(numLimit).lean();
      results.appointments = appts.map((a) => ({
        id: a._id,
        title: `${a.patientName} with ${a.doctorName}`,
        subtitle: `${a.slotDate} at ${a.slotTime} (${a.status})`,
        category: "Appointment",
        route: `/appointments`,
        metadata: { status: a.status, appointmentId: a.appointmentId },
      }));
      totalFound += appts.length;
    }

    // 3. Operational Tasks
    if (category === "all" || category === "tasks") {
      const taskFilter = { $or: [{ title: regex }, { department: regex }, { "assignedTo.name": regex }] };
      if (hospitalId) taskFilter.$or = [{ hospitalId }, { hospitalId: null }];
      const tasks = await taskModel.find(taskFilter).select("title department status priority dueDate assignedTo").limit(numLimit).lean();
      results.tasks = tasks.map((t) => ({
        id: t._id,
        title: t.title,
        subtitle: `${t.department} • ${t.status} (${t.priority})`,
        category: "Task",
        route: `/tasks`,
        metadata: { status: t.status, priority: t.priority },
      }));
      totalFound += tasks.length;
    }

    // 4. Support Tickets
    if (category === "all" || category === "support") {
      const ticketFilter = { $or: [{ ticketNumber: regex }, { subject: regex }, { category: regex }, { patientName: regex }] };
      if (hospitalId) ticketFilter.$or = [{ hospitalId }, { hospitalId: null }];
      const tickets = await supportTicketModel.find(ticketFilter).select("ticketNumber subject status priority patientName").limit(numLimit).lean();
      results.support = tickets.map((t) => ({
        id: t._id,
        title: `[${t.ticketNumber}] ${t.subject}`,
        subtitle: `Patient: ${t.patientName || "Anonymous"} • ${t.status}`,
        category: "Support Ticket",
        route: `/support`,
        metadata: { status: t.status, priority: t.priority },
      }));
      totalFound += tickets.length;
    }

    // 5. Hospital Resources
    if (category === "all" || category === "resources") {
      const resFilter = { $or: [{ name: regex }, { identifier: regex }, { department: regex }, { category: regex }] };
      if (hospitalId) resFilter.hospitalId = hospitalId;
      const resources = await resourceModel.find(resFilter).select("name identifier category department status location").limit(numLimit).lean();
      results.resources = resources.map((r) => ({
        id: r._id,
        title: `${r.name} (${r.identifier})`,
        subtitle: `${r.category.toUpperCase()} • ${r.department} • ${r.status}`,
        category: "Resource",
        route: `/resources`,
        metadata: { status: r.status, category: r.category },
      }));
      totalFound += resources.length;
    }

    // 6. Hospitals (if platform/super-admin)
    if ((category === "all" || category === "hospitals") && !hospitalId) {
      const hospitals = await hospitalModel.find({ $or: [{ name: regex }, { city: regex }] }).select("name city address status").limit(numLimit).lean();
      results.hospitals = hospitals.map((h) => ({
        id: h._id,
        title: h.name,
        subtitle: `${h.city || "India"}`,
        category: "Hospital",
        route: `/hospitals`,
        metadata: { city: h.city },
      }));
      totalFound += hospitals.length;
    }

    return res.status(200).json({
      success: true,
      query: q,
      total: totalFound,
      results,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
