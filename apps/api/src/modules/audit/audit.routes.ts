import prisma from '../../lib/prisma';
import { Router } from 'express';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
import { getAuditPhotos } from './audit.controller';

const router = Router();

// GET /api/audit
// Restricted to roles with 'audit:view' permission (Owner, Branch Manager, Accountant).
// Retains activities for past 6 months (180 days) and supports date range filtering.
router.get('/', protect, requirePermission('audit:view'), async (req: any, res) => {
  try {
    const companyId = req.user.companyId;

    // 6-month retention baseline (180 days)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const where: any = {
      companyId,
      createdAt: { gte: sixMonthsAgo }
    };

    const { startDate, endDate } = req.query;

    if (startDate) {
      const parsedStart = new Date(String(startDate));
      if (!isNaN(parsedStart.getTime())) {
        parsedStart.setHours(0, 0, 0, 0);
        // Ensure query cannot exceed the 6-month retention baseline
        const effectiveStart = parsedStart > sixMonthsAgo ? parsedStart : sixMonthsAgo;
        where.createdAt.gte = effectiveStart;
      }
    }

    if (endDate) {
      const parsedEnd = new Date(String(endDate));
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        where.createdAt.lte = parsedEnd;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/photos', protect, requirePermission('audit:view'), getAuditPhotos);

export default router;
