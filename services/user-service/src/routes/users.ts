import { Router } from "express";
import { requireGatewayAuth } from "../middleware/gatewayAuth";
import { getProfile, getDashboard } from "../controllers/userController";

const router = Router();

router.use(requireGatewayAuth);

router.get("/profile", getProfile);
router.get("/dashboard", getDashboard);

export default router;
