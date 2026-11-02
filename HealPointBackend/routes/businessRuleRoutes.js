import express from "express";
import {
  getBusinessRules,
  updateBusinessRule,
  toggleBusinessRule,
  rollbackBusinessRule,
} from "../controllers/businessRuleController.js";

const router = express.Router();

router.get("/", getBusinessRules);
router.put("/:id", updateBusinessRule);
router.patch("/:id/toggle", toggleBusinessRule);
router.post("/:id/rollback", rollbackBusinessRule);

export default router;
