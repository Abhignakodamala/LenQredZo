import prisma from '../../lib/prisma';
import { Router } from 'express';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, async (req: any, res) => {
  try {
    const companyId = req.user.companyId;
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
