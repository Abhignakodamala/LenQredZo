import type { Response } from 'express';
import prisma from '../../lib/prisma';

export const getAuditPhotos = async (req: any, res: Response) => {
  try {
    const companyId = Number(req.user?.companyId);

    if (!req.user || !companyId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const photos = await prisma.auditLog.findMany({
      where: {
        companyId,
        AND: [
          { photoData: { not: null } },
          { photoData: { not: '' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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