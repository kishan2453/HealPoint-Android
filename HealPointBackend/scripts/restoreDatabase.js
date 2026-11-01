import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const BACKUP_ROOT = path.resolve("backups");

/**
 * Validates backup integrity and checks checksums
 * Usage:
 *  node scripts/restoreDatabase.js --dry-run [backup-folder-name]
 */
export async function testRestoreIntegrity(targetFolder = null) {
  if (!fs.existsSync(BACKUP_ROOT)) {
    return { success: false, message: "No backups folder found" };
  }

  const backups = fs.readdirSync(BACKUP_ROOT).filter((d) => d.startsWith("backup-")).sort();
  if (backups.length === 0) {
    return { success: false, message: "No backups available to verify" };
  }

  const selectedBackup = targetFolder || backups[backups.length - 1];
  const backupDir = path.join(BACKUP_ROOT, selectedBackup);

  console.log(`[Restore Test] Verifying backup integrity: ${selectedBackup}`);

  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { success: false, message: "Manifest file missing in backup" };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const results = {
    backupId: manifest.backupId,
    verifiedFiles: 0,
    totalRecords: 0,
    integrityChecksPassed: true,
    fileStatus: {},
  };

  for (const [colName, expectedHash] of Object.entries(manifest.checksums || {})) {
    const colFile = path.join(backupDir, `${colName}.json`);
    if (!fs.existsSync(colFile)) {
      results.integrityChecksPassed = false;
      results.fileStatus[colName] = "MISSING";
      continue;
    }

    const content = fs.readFileSync(colFile, "utf8");
    const actualHash = crypto.createHash("sha256").update(content).digest("hex");

    if (actualHash === expectedHash) {
      results.verifiedFiles++;
      const records = JSON.parse(content);
      results.totalRecords += Array.isArray(records) ? records.length : 0;
      results.fileStatus[colName] = "CHECKSUM_VALIDATED";
    } else {
      results.integrityChecksPassed = false;
      results.fileStatus[colName] = "CORRUPTED_HASH_MISMATCH";
    }
  }

  console.log(`[Restore Test] Results:`, results);
  return { success: results.integrityChecksPassed, results };
}

if (process.argv[1]?.endsWith("restoreDatabase.js")) {
  const isDryRun = process.argv.includes("--dry-run");
  const folderArg = process.argv.find((a) => a.startsWith("backup-"));

  testRestoreIntegrity(folderArg)
    .then((res) => {
      if (res.success) {
        console.log("Integrity test PASSED 100%");
        process.exit(0);
      } else {
        console.error("Integrity test FAILED:", res.message);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Test error:", err);
      process.exit(1);
    });
}

