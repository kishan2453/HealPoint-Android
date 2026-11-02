import express from "express";
import {
  getImportTemplate,
  importSyntheticData,
  getImportHistory,
  rollbackImport,
} from "../controllers/importExportController.js";

const router = express.Router();

router.get("/template", getImportTemplate);
router.post("/execute", importSyntheticData);
router.get("/history", getImportHistory);
router.post("/rollback/:id", rollbackImport);

export default router;
