import { Router } from "express";
import { getDashboardStats, getTodayOverview, getAnalytics, getSystemHealth, getFinancialYearAnalytics, exportFinancialYearAuditReport } from './dashboard.controller';
import { protect } from "../../middleware/auth";

const router = Router();
router.get('/health', protect, getSystemHealth);
router.get("/stats", protect, getDashboardStats);
router.get("/analytics", protect, getAnalytics);
router.get("/financial-year-analytics", protect, getFinancialYearAnalytics);
router.get("/financial-year-export", protect, exportFinancialYearAuditReport);
router.get("/today", protect, getTodayOverview);

export default router;