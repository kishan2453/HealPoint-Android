import express from "express";
import {
  getAllHospitals,
  getHospitalDetails,
  compareHospitals,
} from "../controllers/hospitalController.js";

const router = express.Router();

router.get("/public/get-all", getAllHospitals);
router.get("/get-all", getAllHospitals);
router.get("/get-all-hospitals", getAllHospitals);
router.get("/all", getAllHospitals);
router.get("/compare", compareHospitals);
router.get("/public/get-details/:id", getHospitalDetails);
router.get("/get-details/:id", getHospitalDetails);
router.get("/:id", getHospitalDetails);

export default router;
