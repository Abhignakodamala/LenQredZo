import type { Response } from 'express';
import prisma from '../../lib/prisma';

/**
 * Clean up audit photos older than 90 days (3 months retention window)
 * to maintain compliance and prevent database storage bloat.
 */
export const purgeAuditPhotosOlderThan3Months = async (companyId?: number) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const where: any = {
      createdAt: { lt: ninetyDaysAgo },
      photoData: { not: null }
    };
    if (companyId) where.companyId = companyId;

    const result = await prisma.auditLog.updateMany({
      where,
      data: { photoData: null }
    });
    return result.count;
  } catch (err) {
    console.error('PURGE OLD AUDIT PHOTOS ERROR:', err);
    return 0;
  }
};

export const getAuditPhotos = async (req: any, res: Response) => {
  try {
    const companyId = Number(req.user?.companyId);

    if (!req.user || !companyId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Retain and display data for the past 3 months (90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Auto-clean any records older than 90 days in the background
    void purgeAuditPhotosOlderThan3Months(companyId);

    const photos = await prisma.auditLog.findMany({
      where: {
        companyId,
        createdAt: { gte: ninetyDaysAgo },
        AND: [
          { photoData: { not: null } },
          { photoData: { not: '' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        photoData: true,
        createdAt: true,
        userName: true
      }
    });

    return res.json(photos);
  } catch (error) {
    console.error('GET AUDIT PHOTOS ERROR:', error);
    return res.status(500).json({ message: 'Could not load audit photos' });
  }
};