import { Router } from "express";
import { getDashboardStats, getTodayOverview, getAnalytics, getSystemHealth } from './dashboard.controller';
import { protect } from "../../middleware/auth";

const router = Router();
router.get('/health', protect, getSystemHealth);
router.get("/stats", protect, getDashboardStats);
router.get("/analytics", protect, getAnalytics);
router.get("/today", protect, getTodayOverview);

export default router;