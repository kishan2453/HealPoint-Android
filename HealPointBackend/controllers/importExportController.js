import importHistoryModel from "../models/importHistoryModel.js";
import staffModel from "../models/staffModel.js";
import resourceModel from "../models/resourceModel.js";
import taskModel from "../models/taskModel.js";

export const getImportTemplate = (req, res) => {
  const { entityType } = req.query;

  let headers = "";
  let sampleRow = "";

  switch (entityType) {
    case "staff":
      headers = "employeeId,name,email,phone,role,department,designation";
      sampleRow = "EMP-901,Dr. Arun Sharma,arun.sharma@healpoint.demo,9876543210,doctor,Cardiology,Senior Consultant";
      break;
    case "resources":
      headers = "identifier,name,category,department,status,capacity,location";
      sampleRow = "BED-ICU-101,ICU Electric Bed 101,bed,ICU,available,1,Wing B Floor 3";
      break;
    case "tasks":
      headers = "title,description,department,priority,dueDate,assigneeName,assigneeRole";
      sampleRow = "Sanitize Diagnostic Wing,Daily sterilization protocol,Operations,medium,2026-11-15,Ramesh Kumar,staff";
      break;
    default:
      return res.status(400).json({ success: false, message: "Invalid entityType for template." });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${entityType}-template.csv"`);
  return res.status(200).send(`${headers}\n${sampleRow}`);
};

export const importSyntheticData = async (req, res) => {
  try {
    const { entityType, records, fileName = "import.csv", hospitalId } = req.body;
    if (!entityType || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Valid entityType and records array required." });
    }

    const targetHospital = hospitalId || req.user?.hospitalId;
    const errors = [];
    const validToInsert = [];

    // Validate rows
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 1;

      if (entityType === "staff") {
        if (!row.name || !row.email || !row.employeeId) {
          errors.push({ row: rowNum, identifier: row.employeeId || "", error: "Missing required name, email, or employeeId" });
          continue;
        }
        // Duplicate check
        const exists = await staffModel.findOne({ hospitalId: targetHospital, employeeId: row.employeeId });
        if (exists) {
          errors.push({ row: rowNum, identifier: row.employeeId, error: "Employee ID already exists" });
          continue;
        }
        validToInsert.push({
          hospitalId: targetHospital,
          employeeId: row.employeeId,
          name: row.name,
          email: row.email,
          phone: row.phone || "9999999999",
          role: row.role || "staff",
          department: row.department || "General",
          designation: row.designation || "Executive",
        });
      } else if (entityType === "resources") {
        if (!row.identifier || !row.name || !row.category) {
          errors.push({ row: rowNum, identifier: row.identifier || "", error: "Missing identifier, name, or category" });
          continue;
        }
        const exists = await resourceModel.findOne({ hospitalId: targetHospital, identifier: row.identifier });
        if (exists) {
          errors.push({ row: rowNum, identifier: row.identifier, error: "Resource identifier already exists" });
          continue;
        }
        validToInsert.push({
          hospitalId: targetHospital,
          identifier: row.identifier,
          name: row.name,
          category: row.category,
          department: row.department || "General",
          status: row.status || "available",
          capacity: Number(row.capacity) || 1,
          location: row.location || "Main Building",
        });
      } else if (entityType === "tasks") {
        if (!row.title || !row.dueDate) {
          errors.push({ row: rowNum, identifier: row.title || "", error: "Missing task title or dueDate" });
          continue;
        }
        validToInsert.push({
          hospitalId: targetHospital,
          title: row.title,
          description: row.description || "",
          department: row.department || "Operations",
          priority: row.priority || "medium",
          status: "New",
          dueDate: new Date(row.dueDate),
          assignedTo: {
            name: row.assigneeName || "Unassigned",
            role: row.assigneeRole || "staff",
          },
          assignedBy: {
            name: req.user?.name || "Importer",
            role: req.user?.role || "admin",
          },
        });
      }
    }

    let insertedRecords = [];
    if (validToInsert.length > 0) {
      if (entityType === "staff") {
        insertedRecords = await staffModel.insertMany(validToInsert);
      } else if (entityType === "resources") {
        insertedRecords = await resourceModel.insertMany(validToInsert);
      } else if (entityType === "tasks") {
        insertedRecords = await taskModel.insertMany(validToInsert);
      }
    }

    const importRecord = await importHistoryModel.create({
      hospitalId: targetHospital,
      entityType,
      fileName,
      totalRows: records.length,
      importedCount: insertedRecords.length,
      failedCount: errors.length,
      errors,
      importedRecordIds: insertedRecords.map((r) => r._id),
      importedBy: req.user?.name || req.user?.email || "Admin",
      status: errors.length === 0 ? "completed" : insertedRecords.length > 0 ? "partially_failed" : "failed",
    });

    return res.status(200).json({
      success: true,
      importId: importRecord._id,
      totalRows: records.length,
      importedCount: insertedRecords.length,
      failedCount: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getImportHistory = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};
    if (hospitalId) query.hospitalId = hospitalId;

    const history = await importHistoryModel.find(query).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ success: true, count: history.length, history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const rollbackImport = async (req, res) => {
  try {
    const { id } = req.params;
    const importRecord = await importHistoryModel.findById(id);
    if (!importRecord) {
      return res.status(404).json({ success: false, message: "Import record not found." });
    }

    if (importRecord.status === "rolled_back") {
      return res.status(400).json({ success: false, message: "This import has already been rolled back." });
    }

    const ids = importRecord.importedRecordIds || [];
    if (ids.length > 0) {
      if (importRecord.entityType === "staff") {
        await staffModel.deleteMany({ _id: { $in: ids } });
      } else if (importRecord.entityType === "resources") {
        await resourceModel.deleteMany({ _id: { $in: ids } });
      } else if (importRecord.entityType === "tasks") {
        await taskModel.deleteMany({ _id: { $in: ids } });
      }
    }

    importRecord.status = "rolled_back";
    await importRecord.save();

    return res.status(200).json({
      success: true,
      message: `Successfully rolled back ${ids.length} records.`,
      importRecord,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
