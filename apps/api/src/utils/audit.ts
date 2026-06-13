import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditParams {
  req: any;                 // the Express request (carries req.user from the token)
  action: string;           // e.g. "MARK_EMI_PAID"
  entityType: string;       // e.g. "EMI", "Customer", "Loan"
  entityId?: number | null;
  details?: string;         // human-readable summary — never raw Aadhaar/PAN
}

export async function logAudit({ req, action, entityType, entityId = null, details }: AuditParams) {
  try {
    const userId: number | null = req?.user?.userId ?? null;

    // Look up the name once so the log is readable ("Ramesh Babu collected...").
    let userName: string | null = null;
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      userName = u?.name ?? null;
    }

    const ip =
      (req?.headers?.['x-forwarded-for'] as string) ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      null;

    await prisma.auditLog.create({
      data: {
        companyId: req?.user?.companyId ?? 0,
        userId,
        userName,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ?? null,
        ipAddress: ip
      }
    });
  } catch (err) {
    // Audit logging must NEVER break the main operation — log and move on.
    console.error('AUDIT LOG ERROR:', err);
  }
}