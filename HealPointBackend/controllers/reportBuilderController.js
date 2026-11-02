import reportConfigModel from "../models/reportConfigModel.js";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import rosterModel from "../models/rosterModel.js";
import waitlistModel from "../models/waitlistModel.js";

const parseDateRange = (preset, customStart, customEnd) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last_7_days":
      start.setDate(now.getDate() - 7);
      break;
    case "last_30_days":
      start.setDate(now.getDate() - 30);
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "custom":
      if (customStart) start = new Date(customStart);
      if (customEnd) end = new Date(customEnd);
      break;
    default:
      start.setDate(now.getDate() - 7);
  }

  return { start, end };
};

export const generateReport = async (req, res) => {
  try {
    const {
      reportType,
      dateRangePreset = "last_7_days",
      customStartDate,
      customEndDate,
      department,
      doctorId,
      status,
      hospitalId,
      format = "json",
    } = req.body;

    const targetHospital = hospitalId || req.user?.hospitalId;
    const { start, end } = parseDateRange(dateRangePreset, customStartDate, customEndDate);

    let rows = [];
    let summary = {};

    switch (reportType) {
      case "appointments":
      case "cancellations_noshow": {
        const query = {
          createdAt: { $gte: start, $lte: end },
        };
        if (targetHospital) query.hospitalId = targetHospital;
        if (department) query.department = department;
        if (doctorId) query.doctorId = doctorId;
        if (status) query.status = status;
        if (reportType === "cancellations_noshow") {
          query.status = { $in: ["cancel", "cancelled", "missed"] };
        }

        const appts = await appointmentModel.find(query).sort({ createdAt: -1 }).limit(500).lean();
        rows = appts.map((a) => ({
          appointmentId: a.appointmentId || a._id,
          patientName: a.patientName || "Anonymous",
          doctorName: a.doctorName || "Doctor",
          department: a.department || "General",
          slotDate: a.slotDate,
          slotTime: a.slotTime,
          status: a.status,
          amount: a.amount || 0,
          paymentStatus: a.paymentStatus || "pending",
          bookedAt: a.createdAt ? new Date(a.createdAt).toISOString() : "",
        }));

        summary = {
          totalRecords: rows.length,
          totalRevenue: rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
          completedCount: rows.filter((r) => r.status === "completed").length,
          cancelledCount: rows.filter((r) => r.status === "cancel" || r.status === "cancelled").length,
        };
        break;
      }

      case "revenue_billing": {
        const query = {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: { $in: ["paid", "completed", "verified"] },
        };
        if (targetHospital) query.hospitalId = targetHospital;

        const paidAppts = await appointmentModel.find(query).limit(500).lean();
        rows = paidAppts.map((a) => ({
          transactionRef: a.paymentDetails?.razorpay_payment_id || a.appointmentId || a._id,
          patientName: a.patientName || "Anonymous",
          doctorName: a.doctorName || "Doctor",
          department: a.department || "General",
          amount: a.amount || 0,
          paymentMethod: a.paymentMethod || "online",
          date: a.createdAt ? new Date(a.createdAt).toISOString().split("T")[0] : "",
        }));

        summary = {
          totalTransactions: rows.length,
          grossRevenueINR: rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
          averageTicketINR: rows.length > 0 ? (rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0) / rows.length).toFixed(2) : 0,
        };
        break;
      }

      case "waitlist_performance": {
        const query = {
          createdAt: { $gte: start, $lte: end },
        };
        if (targetHospital) query.hospitalId = targetHospital;

        const waitlistItems = await waitlistModel.find(query).limit(500).lean();
        rows = waitlistItems.map((w) => ({
          patientName: w.patientName,
          doctorName: w.doctorName,
          preferredDate: w.preferredDate,
          status: w.status,
          priority: w.priority,
          notifiedAt: w.notifiedAt ? new Date(w.notifiedAt).toISOString() : "None",
          createdAt: new Date(w.createdAt).toISOString(),
        }));

        summary = {
          totalWaitlisted: rows.length,
          converted: rows.filter((r) => r.status === "converted").length,
          pending: rows.filter((r) => r.status === "active").length,
        };
        break;
      }

      default: {
        return res.status(400).json({ success: false, message: `Unsupported report type: ${reportType}` });
      }
    }

    if (format === "csv") {
      if (rows.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report.csv"`);
        return res.send("No records found for this period");
      }
      const headers = Object.keys(rows[0]).join(",");
      const csvLines = rows.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csvData = [headers, ...csvLines].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report.csv"`);
      return res.status(200).send(csvData);
    }

    return res.status(200).json({
      success: true,
      reportType,
      dateRange: { start, end },
      summary,
      rows,
      generatedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSavedReportConfigs = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};
    if (hospitalId) query.$or = [{ hospitalId }, { hospitalId: null }];

    const configs = await reportConfigModel.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, count: configs.length, configs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveReportConfig = async (req, res) => {
  try {
    const { name, description, reportType, dateRangePreset, filters, selectedColumns, exportFormat, hospitalId } = req.body;
    if (!name || !reportType) {
      return res.status(400).json({ success: false, message: "Name and reportType are required." });
    }

    const config = await reportConfigModel.create({
      hospitalId: hospitalId || req.user?.hospitalId || null,
      name,
      description: description || "",
      reportType,
      dateRangePreset: dateRangePreset || "last_7_days",
      filters: filters || {},
      selectedColumns: selectedColumns || [],
      exportFormat: exportFormat || "csv",
      createdBy: req.user?.name || "Admin",
    });

    return res.status(201).json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
