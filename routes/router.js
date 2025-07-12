import express from "express";
import { apiRoute } from "../controllers/api.js";

const router = express.Router();

router.post("/norkVid", apiRoute);

export default router;
