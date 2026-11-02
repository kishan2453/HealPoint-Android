import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import taskModel from "../models/taskModel.js";
import resourceModel from "../models/resourceModel.js";
import hospitalModel from "../models/hospitalModel.js";

/**
 * AI-Powered Administrative Assistant Controller
 * Operates strictly on authorized operational and hospital metrics.
 * Strictly non-clinical, zero medical advice.
 */

export const askAdminAssistant = async (req, res) => {
  try {
    const { query, hospitalId } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: "Question/query cannot be empty." });
    }

    const cleanQuery = query.toLowerCase().trim();
    const targetHospital = hospitalId || req.user?.hospitalId;

    // Base filters for tenant isolation
    const apptFilter = {};
    const taskFilter = {};
    const resourceFilter = {};
    const doctorFilter = {};

    if (targetHospital) {
      apptFilter.hospitalId = targetHospital;
      taskFilter.hospitalId = targetHospital;
      resourceFilter.hospitalId = targetHospital;
      doctorFilter.hospitalId = targetHospital;
    }

    // 1. Fetch live aggregate data
    const [appointments, doctors, tasks, resources, hospitals] = await Promise.all([
      appointmentModel.find(apptFilter).select("department status slotDate slotTime amount doctorId createdAt").lean(),
      doctorModel.find(doctorFilter).select("name specialty available hospitalId").lean(),
      taskModel.find(taskFilter).select("title department status priority dueDate assignedTo").lean(),
      resourceModel.find(resourceFilter).select("name category department status").lean(),
      targetHospital ? hospitalModel.findById(targetHospital).select("name city").lean() : hospitalModel.find().select("name city").lean(),
    ]);

    const hospitalName = Array.isArray(hospitals)
      ? "All Network Hospitals"
      : hospitals?.name || "HealPoint Hospital";

    // 2. Department loads
    const deptLoads = {};
    const dayCancellations = {};
    let totalCancelled = 0;
    let totalCompleted = 0;

    appointments.forEach((a) => {
      const d = a.department || "General";
      deptLoads[d] = (deptLoads[d] || 0) + 1;

      const isCancelled = a.status === "cancel" || a.status === "cancelled";
      if (isCancelled) {
        totalCancelled++;
        const dateKey = a.slotDate || (a.createdAt ? new Date(a.createdAt).toISOString().split("T")[0] : "Unknown");
        dayCancellations[dateKey] = (dayCancellations[dateKey] || 0) + 1;
      }
      if (a.status === "completed") {
        totalCompleted++;
      }
    });

    // 3. Overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "Completed" && t.status !== "Cancelled"
    );

    // 4. Resource utilization
    const occupiedResources = resources.filter((r) => r.status === "occupied");
    const resourceUtilizationRate = resources.length > 0
      ? ((occupiedResources.length / resources.length) * 100).toFixed(1)
      : "0.0";

    // Intent recognition logic for natural questions
    let answer = "";
    let keyMetrics = {};
    let suggestions = [];

    if (cleanQuery.includes("department") && (cleanQuery.includes("highest") || cleanQuery.includes("load") || cleanQuery.includes("most"))) {
      const sortedDepts = Object.entries(deptLoads).sort((a, b) => b[1] - a[1]);
      if (sortedDepts.length === 0) {
        answer = `Currently, there are no recorded appointments for ${hospitalName}. Please ensure appointments are scheduled to analyze department workload.`;
      } else {
        const top = sortedDepts[0];
        answer = `Based on live records for ${hospitalName}, **${top[0]}** currently handles the highest appointment volume with **${top[1]} appointments** (${((top[1] / Math.max(1, appointments.length)) * 100).toFixed(1)}% of total volume).`;
        keyMetrics = {
          topDepartment: top[0],
          departmentBookings: top[1],
          totalAppointments: appointments.length,
        };
        suggestions = [
          `Consider allocating additional staff shifts to ${top[0]}.`,
          `Verify waiting lounge capacity for ${top[0]} during peak morning hours.`,
        ];
      }
    } else if (cleanQuery.includes("cancel") || cleanQuery.includes("cancellation")) {
      const sortedDays = Object.entries(dayCancellations).sort((a, b) => b[1] - a[1]);
      const cancellationRate = appointments.length > 0 ? ((totalCancelled / appointments.length) * 100).toFixed(1) : "0.0";

      if (sortedDays.length === 0) {
        answer = `Great news! Zero appointment cancellations have been logged for ${hospitalName}. Overall cancellation rate is 0.0%.`;
      } else {
        const topDay = sortedDays[0];
        answer = `The overall appointment cancellation rate is **${cancellationRate}%** (${totalCancelled} of ${appointments.length} appointments). The highest concentration occurred on **${topDay[0]}** with **${topDay[1]} cancellations**.`;
        keyMetrics = {
          cancellationRate: `${cancellationRate}%`,
          totalCancelled,
          peakCancellationDate: topDay[0],
        };
        suggestions = [
          "Enable automated appointment waitlist backfill to immediately replace cancelled slots.",
          "Review automated SMS/App notification reminder frequency 24h prior to appointments.",
        ];
      }
    } else if (cleanQuery.includes("overdue") || cleanQuery.includes("task")) {
      answer = `There are currently **${overdueTasks.length} overdue tasks** out of **${tasks.length} total operational tasks** for ${hospitalName}.`;
      keyMetrics = {
        overdueCount: overdueTasks.length,
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled").length,
      };
      if (overdueTasks.length > 0) {
        suggestions = overdueTasks.slice(0, 3).map(
          (t) => `Escalate task "${t.title}" (Due: ${new Date(t.dueDate).toLocaleDateString()}, Dept: ${t.department})`
        );
      } else {
        suggestions.push("All operational tasks are currently within their target completion deadlines.");
      }
    } else if (cleanQuery.includes("capacity") || cleanQuery.includes("resource") || cleanQuery.includes("bed") || cleanQuery.includes("utilization")) {
      answer = `Facility resource utilization across rooms, beds, and diagnostic equipment is at **${resourceUtilizationRate}%** (${occupiedResources.length} of ${resources.length} active units currently in use).`;
      keyMetrics = {
        totalResources: resources.length,
        occupiedUnits: occupiedResources.length,
        availableUnits: resources.length - occupiedResources.length,
        utilizationRate: `${resourceUtilizationRate}%`,
      };
      suggestions = [
        "Monitor departments exceeding 85% bed occupancy for patient transfer planning.",
        "Ensure preventative maintenance inspections are logged for critical diagnostic apparatus.",
      ];
    } else if (cleanQuery.includes("doctor") || cleanQuery.includes("utilization") || cleanQuery.includes("doctor load")) {
      const doctorAppts = {};
      appointments.forEach((a) => {
        if (a.doctorId) {
          const docId = String(a.doctorId);
          doctorAppts[docId] = (doctorAppts[docId] || 0) + 1;
        }
      });
      const topDocEntry = Object.entries(doctorAppts).sort((a, b) => b[1] - a[1])[0];
      const topDoc = topDocEntry ? doctors.find((d) => String(d._id) === topDocEntry[0]) : null;

      answer = topDoc
        ? `Dr. **${topDoc.name}** (${topDoc.specialty}) has the highest scheduled consultations with **${topDocEntry[1]} bookings** across the system.`
        : `Active doctor scheduling is balanced across all ${doctors.length} onboarded clinical specialists.`;

      keyMetrics = {
        activeDoctorsCount: doctors.length,
        topConsultant: topDoc ? topDoc.name : "N/A",
      };
      suggestions = [
        "Implement queue pacing and rest intervals between high-volume consultation blocks.",
      ];
    } else {
      // General executive operational summary
      answer = `**Operational Overview for ${hospitalName}**: The facility currently tracks **${appointments.length} appointments** across ${Object.keys(deptLoads).length} departments, **${doctors.length} registered doctors**, **${resources.length} physical resources** (utilization: ${resourceUtilizationRate}%), and **${tasks.length} operational tasks** (${overdueTasks.length} overdue).`;

      keyMetrics = {
        totalAppointments: appointments.length,
        completedAppointments: totalCompleted,
        activeDoctors: doctors.length,
        resourceUtilization: `${resourceUtilizationRate}%`,
        overdueTasks: overdueTasks.length,
      };

      suggestions = [
        "Audit pending departmental tasks scheduled for completion this week.",
        "Review queue throughput for peak morning hours (10:00 AM - 1:00 PM).",
        "Maintain active waitlists to maximize clinical slot utilization.",
      ];
    }

    return res.status(200).json({
      success: true,
      query,
      answer,
      keyMetrics,
      suggestions,
      disclaimer: "HealPoint Operational AI provides administrative, non-clinical analytics only. It does not provide medical diagnoses or healthcare decisions.",
      generatedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
