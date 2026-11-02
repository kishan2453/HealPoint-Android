import mongoose from "mongoose";
import hospitalSubscriptionPlanModel from "../models/hospitalSubscriptionPlanModel.js";
import hospitalSubscriptionModel from "../models/hospitalSubscriptionModel.js";
import simulatedInvoiceModel from "../models/simulatedInvoiceModel.js";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { resolveHospitalId } from "./hospitalAdminController.js";

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// Seed default plans if none exist
const ensureDefaultPlans = async () => {
  const count = await hospitalSubscriptionPlanModel.countDocuments();
  if (count === 0) {
    await hospitalSubscriptionPlanModel.create([
      {
        name: "Starter Clinic Plan",
        code: "starter",
        description: "Ideal for small clinics and independent healthcare centers",
        monthlyPriceSimulated: 2999,
        yearlyPriceSimulated: 29990,
        maxDoctors: 5,
        maxAppointmentsPerMonth: 300,
        features: ["Queue Management", "Basic Roster", "Smart Scheduling"],
        hasQueueManagement: true,
        hasResourceManagement: false,
        hasStaffRoster: true,
        hasAdvancedAnalytics: false,
        badge: "Basic",
        sortOrder: 1,
      },
      {
        name: "Professional Hospital Plan",
        code: "professional",
        description: "Full suite for multi-specialty hospitals with complete operational tools",
        monthlyPriceSimulated: 7999,
        yearlyPriceSimulated: 79990,
        maxDoctors: 25,
        maxAppointmentsPerMonth: 2000,
        features: ["Digital Queue", "Resource Inventory", "Staff Duty Roster", "Smart Scheduling", "Standard Analytics"],
        hasQueueManagement: true,
        hasResourceManagement: true,
        hasStaffRoster: true,
        hasAdvancedAnalytics: true,
        badge: "Recommended",
        sortOrder: 2,
      },
      {
        name: "Enterprise Multi-Facility Suite",
        code: "enterprise",
        description: "Unlimited capacity, predictive forecasting, priority support & full platform power",
        monthlyPriceSimulated: 15999,
        yearlyPriceSimulated: 159990,
        maxDoctors: 100,
        maxAppointmentsPerMonth: 10000,
        features: ["Digital Queue", "Hospital Capacity & Equipment", "Staff Duty Roster", "Predictive Analytics", "Unlimited Patient Journey"],
        hasQueueManagement: true,
        hasResourceManagement: true,
        hasStaffRoster: true,
        hasAdvancedAnalytics: true,
        badge: "Enterprise",
        sortOrder: 3,
      },
    ]);
  }
};

export const getHospitalPlans = async (req, res) => {
  try {
    await ensureDefaultPlans();
    const plans = await hospitalSubscriptionPlanModel.find({ isActive: true }).sort({ sortOrder: 1 });
    return res.status(200).json({ success: true, count: plans.length, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createHospitalPlan = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      monthlyPriceSimulated,
      yearlyPriceSimulated,
      maxDoctors,
      maxAppointmentsPerMonth,
      features,
      hasQueueManagement,
      hasResourceManagement,
      hasStaffRoster,
      hasAdvancedAnalytics,
      badge,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Plan name and code are required" });
    }

    const existing = await hospitalSubscriptionPlanModel.findOne({ code: code.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Plan with code "${code}" already exists` });
    }

    const newPlan = await hospitalSubscriptionPlanModel.create({
      name: name.trim(),
      code: code.toLowerCase().trim(),
      description: description || "",
      monthlyPriceSimulated: Number(monthlyPriceSimulated) || 0,
      yearlyPriceSimulated: Number(yearlyPriceSimulated) || 0,
      maxDoctors: Number(maxDoctors) || 10,
      maxAppointmentsPerMonth: Number(maxAppointmentsPerMonth) || 500,
      features: Array.isArray(features) ? features : [],
      hasQueueManagement: hasQueueManagement !== false,
      hasResourceManagement: Boolean(hasResourceManagement),
      hasStaffRoster: Boolean(hasStaffRoster),
      hasAdvancedAnalytics: Boolean(hasAdvancedAnalytics),
      badge: badge || "Custom",
      isActive: true,
    });

    return res.status(201).json({ success: true, message: "Subscription plan created", plan: newPlan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHospitalPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await hospitalSubscriptionPlanModel.findById(id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const fields = [
      "name",
      "description",
      "monthlyPriceSimulated",
      "yearlyPriceSimulated",
      "maxDoctors",
      "maxAppointmentsPerMonth",
      "features",
      "hasQueueManagement",
      "hasResourceManagement",
      "hasStaffRoster",
      "hasAdvancedAnalytics",
      "badge",
      "isActive",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) plan[f] = req.body[f];
    });

    await plan.save();
    return res.status(200).json({ success: true, message: "Plan updated", plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalSubscription = async (req, res) => {
  try {
    let hospitalId = req.params.hospitalId || req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    if (!hospitalId || !isValidId(hospitalId)) {
      return res.status(400).json({ success: false, message: "Valid Hospital ID is required" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    await ensureDefaultPlans();

    let subscription = await hospitalSubscriptionModel
      .findOne({ hospitalId })
      .populate("planId");

    // If no subscription assigned yet, assign Professional plan by default
    if (!subscription) {
      const defaultPlan = await hospitalSubscriptionPlanModel.findOne({ code: "professional" }) ||
        await hospitalSubscriptionPlanModel.findOne();

      subscription = await hospitalSubscriptionModel.create({
        hospitalId,
        hospitalName: hospital.name,
        planId: defaultPlan?._id,
        planCode: defaultPlan?.code || "professional",
        planName: defaultPlan?.name || "Professional Hospital Plan",
        status: "active",
        simulatedFee: defaultPlan?.monthlyPriceSimulated || 7999,
        limits: {
          maxDoctors: defaultPlan?.maxDoctors || 25,
          maxAppointmentsPerMonth: defaultPlan?.maxAppointmentsPerMonth || 2000,
          allowedFeatures: defaultPlan?.features || ["queue", "resources", "roster", "analytics"],
        },
      });
    }

    // Calculate live usage meter
    const activeDoctorsCount = await doctorModel.countDocuments({
      hospitalId,
      isActive: true,
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const appointmentsThisMonth = await appointmentModel.countDocuments({
      hospitalId,
      createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
    });

    const usageMeter = {
      doctors: {
        used: activeDoctorsCount,
        limit: subscription.limits?.maxDoctors || 25,
        percentage: Math.min(100, Math.round((activeDoctorsCount / (subscription.limits?.maxDoctors || 25)) * 100)),
      },
      appointments: {
        used: appointmentsThisMonth,
        limit: subscription.limits?.maxAppointmentsPerMonth || 2000,
        percentage: Math.min(100, Math.round((appointmentsThisMonth / (subscription.limits?.maxAppointmentsPerMonth || 2000)) * 100)),
      },
    };

    const daysUntilExpiry = Math.max(0, Math.ceil((new Date(subscription.expiryDate) - Date.now()) / (1000 * 60 * 60 * 24)));
    const renewalNotice = daysUntilExpiry <= 30;

    return res.status(200).json({
      success: true,
      hospital: {
        _id: hospital._id,
        name: hospital.name,
        location: hospital.location,
      },
      subscription,
      usageMeter,
      daysUntilExpiry,
      renewalNotice,
      renewalMessage: renewalNotice
        ? `Notice: Your hospital plan renews in ${daysUntilExpiry} days. All features remain fully operational.`
        : "Subscription is in good standing.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignHospitalPlan = async (req, res) => {
  try {
    const { hospitalId, planCode, billingCycle = "monthly" } = req.body;
    if (!hospitalId || !isValidId(hospitalId) || !planCode) {
      return res.status(400).json({ success: false, message: "Valid hospitalId and planCode are required" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const plan = await hospitalSubscriptionPlanModel.findOne({ code: planCode.toLowerCase().trim() });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const simulatedFee = billingCycle === "yearly" ? plan.yearlyPriceSimulated : plan.monthlyPriceSimulated;
    const durationDays = billingCycle === "yearly" ? 365 : 30;
    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    let subscription = await hospitalSubscriptionModel.findOne({ hospitalId });
    if (subscription) {
      subscription.planId = plan._id;
      subscription.planCode = plan.code;
      subscription.planName = plan.name;
      subscription.status = "active";
      subscription.billingCycle = billingCycle;
      subscription.simulatedFee = simulatedFee;
      subscription.expiryDate = expiryDate;
      subscription.limits = {
        maxDoctors: plan.maxDoctors,
        maxAppointmentsPerMonth: plan.maxAppointmentsPerMonth,
        allowedFeatures: plan.features,
      };
      await subscription.save();
    } else {
      subscription = await hospitalSubscriptionModel.create({
        hospitalId,
        hospitalName: hospital.name,
        planId: plan._id,
        planCode: plan.code,
        planName: plan.name,
        status: "active",
        billingCycle,
        simulatedFee,
        expiryDate,
        limits: {
          maxDoctors: plan.maxDoctors,
          maxAppointmentsPerMonth: plan.maxAppointmentsPerMonth,
          allowedFeatures: plan.features,
        },
      });
    }

    // Automatically generate a simulated invoice for record keeping
    const invCount = await simulatedInvoiceModel.countDocuments();
    const invoiceNumber = `INV-HOSP-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, "0")}`;

    await simulatedInvoiceModel.create({
      invoiceNumber,
      hospitalId,
      hospitalName: hospital.name,
      planName: plan.name,
      amount: simulatedFee,
      currency: "INR",
      billingPeriod: `${billingCycle.toUpperCase()} (${new Date().toLocaleDateString("en-IN")})`,
      status: "paid_simulated",
      paymentMethod: "Platform Credit (Simulated)",
      transactionReference: `SIM-TXN-${Date.now()}`,
      items: [
        {
          description: `${plan.name} - ${billingCycle.toUpperCase()} Subscription (Simulated)`,
          amount: simulatedFee,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: `Hospital successfully assigned to ${plan.name}`,
      subscription,
      invoiceNumber,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalInvoices = async (req, res) => {
  try {
    let hospitalId = req.params.hospitalId || req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    const query = {};
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = hospitalId;

    const invoices = await simulatedInvoiceModel
      .find(query)
      .populate("hospitalId", "name location")
      .sort({ issueDate: -1 });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuperAdminSubscriptionOverview = async (req, res) => {
  try {
    await ensureDefaultPlans();
    const totalPlans = await hospitalSubscriptionPlanModel.countDocuments({ isActive: true });
    const totalSubscriptions = await hospitalSubscriptionModel.countDocuments();
    const activeSubscriptions = await hospitalSubscriptionModel.countDocuments({ status: "active" });

    const subscriptions = await hospitalSubscriptionModel
      .find()
      .populate("hospitalId", "name location phone email")
      .populate("planId", "name code monthlyPriceSimulated maxDoctors")
      .sort({ createdAt: -1 });

    const totalSimulatedRevenue = subscriptions.reduce((acc, s) => acc + (s.simulatedFee || 0), 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalPlans,
        totalSubscriptions,
        activeSubscriptions,
        totalSimulatedRevenue,
        currency: "INR",
      },
      subscriptions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
