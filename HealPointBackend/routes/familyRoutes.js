import express from "express";
import {
  getFamilyMembers,
  getFamilyMemberById,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} from "../controllers/familyController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/", authenticate, getFamilyMembers);
router.post("/", authenticate, addFamilyMember);

router.get("/user/:userId", authenticate, getFamilyMembers);
router.post("/user/:userId", authenticate, addFamilyMember);

router.get("/:memberId", authenticate, getFamilyMemberById);
router.patch("/:memberId", authenticate, updateFamilyMember);
router.put("/:memberId", authenticate, updateFamilyMember);
router.delete("/:memberId", authenticate, deleteFamilyMember);

router.get("/user/:userId/:memberId", authenticate, getFamilyMemberById);
router.patch("/user/:userId/:memberId", authenticate, updateFamilyMember);
router.put("/user/:userId/:memberId", authenticate, updateFamilyMember);
router.delete("/user/:userId/:memberId", authenticate, deleteFamilyMember);

export default router;

