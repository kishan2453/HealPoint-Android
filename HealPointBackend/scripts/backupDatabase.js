import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Hospital from "../models/hospitalModel.js";
import Appointment from "../models/appointmentModel.js";
import Notification from "../models/notificationModel.js";
import Prescription from "../models/prescriptionModel.js";
import Review from "../models/reviewModel.js";
import MedicationReminder from "../models/medicationReminderModel.js";

const MAX_BACKUP_RETENTION = 7;
const BACKUP_ROOT = path.resolve("backups");

async function runBackup() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Error: MONGO_URI not configured in environment");
    process.exit(1);
  }

  // Mask credentials for logging
  const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`Connecting to MongoDB at: ${maskedUri}`);

  await mongoose.connect(mongoUri);
  console.log("Connected to database successfully.");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(BACKUP_ROOT, `backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = [
    { name: "users", model: User },
    { name: "doctors", model: Doctor },
    { name: "hospitals", model: Hospital },
    { name: "appointments", model: Appointment },
    { name: "notifications", model: Notification },
    { name: "prescriptions", model: Prescription },
    { name: "reviews", model: Review },
    { name: "medication_reminders", model: MedicationReminder },
  ];

  const manifest = {
    backupId: `hp-backup-${timestamp}`,
    createdAt: new Date().toISOString(),
    databaseName: mongoose.connection.name || "healpoint",
    collections: {},
    checksums: {},
  };

  for (const col of collections) {
    try {
      const records = await col.model.find({}).lean();
      const filePath = path.join(backupDir, `${col.name}.json`);
      const serialized = JSON.stringify(records, null, 2);
      fs.writeFileSync(filePath, serialized, "utf8");

      const hash = crypto.createHash("sha256").update(serialized).digest("hex");
      manifest.collections[col.name] = records.length;
      manifest.checksums[col.name] = hash;

      console.log(`[Backup] Exported ${col.name}: ${records.length} records (SHA256: ${hash.slice(0, 12)}...)`);
    } catch (err) {
      console.warn(`[Backup Warning] Could not export ${col.name}:`, err.message);
    }
  }

  // Write manifest
  fs.writeFileSync(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(`\nBackup completed successfully: ${backupDir}`);

  // Enforce retention policy
  try {
    const existing = fs
      .readdirSync(BACKUP_ROOT)
      .filter((d) => d.startsWith("backup-"))
      .sort();

    if (existing.length > MAX_BACKUP_RETENTION) {
      const toDelete = existing.slice(0, existing.length - MAX_BACKUP_RETENTION);
      for (const oldBackup of toDelete) {
        const delPath = path.join(BACKUP_ROOT, oldBackup);
        fs.rmSync(delPath, { recursive: true, force: true });
        console.log(`[Retention Policy] Pruned historical backup: ${oldBackup}`);
      }
    }
  } catch (err) {
    console.warn("[Retention Policy Warning]:", err.message);
  }

  await mongoose.disconnect();
  console.log("Database disconnected safely.");
}

if (process.argv[1]?.endsWith("backupDatabase.js")) {
  runBackup().catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
}

export { runBackup };

