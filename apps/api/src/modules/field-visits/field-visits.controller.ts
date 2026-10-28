import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { logAudit } from '../../utils/audit';
import { isBranchScoped } from '../../utils/scoping';

// IST Time Helper
const getISTDateRange = (dateStr?: string) => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const targetDateStr = dateStr || istNow.toISOString().slice(0, 10);

  const startOfDay = new Date(`${targetDateStr}T00:00:00+05:30`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999+05:30`);
  return { startOfDay, endOfDay, dateStr: targetDateStr };
};

// POST /api/field-visits
export const logFieldVisit = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      customerId,
      loanId,
      latitude,
      longitude,
      accuracy,
      addressSnapshot = '',
      outcome = 'door_locked',
      ptpDate,
      ptpAmount,
      remarks = '',
      photoData
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: Number(customerId) }
    });

    if (!customer || customer.companyId !== user.companyId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let loanRef = '—';
    if (loanId) {
      const loan = await prisma.loan.findUnique({ where: { id: Number(loanId) } });
      if (loan) loanRef = `LN${1000 + loan.id}`;
    }

    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const visitId = `VISIT-${datePrefix}-${randomSuffix}`;

    const lat = Number(latitude);
    const lng = Number(longitude);
    const googleMapsUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

    const visitPayload = {
      visitId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: [customer.street, customer.city, customer.address].filter(Boolean).join(', '),
      loanId: loanId ? Number(loanId) : null,
      loanRef,
      latitude: lat || null,
      longitude: lng || null,
      accuracy: accuracy ? Number(accuracy) : null,
      googleMapsUrl,
      addressSnapshot: addressSnapshot || 'Field Visit Location',
      outcome,
      ptpDate: ptpDate || null,
      ptpAmount: ptpAmount ? Number(ptpAmount) : null,
      remarks,
      visitedAt: now.toISOString(),
      agentId: user.userId,
      agentName: user.name || 'Field Collection Agent',
      agentRole: user.role,
      branchId: user.branchId || null
    };

    // Store in AuditLog for permanent tamper-proof audit trail
    await logAudit({
      req,
      action: 'FIELD_VISIT_LOGGED',
      entityType: 'FieldVisit',
      entityId: customer.id,
      details: JSON.stringify(visitPayload),
      photoData: photoData || null
    });

    res.json({
      success: true,
      message: 'Geo-tagged field visit proof logged successfully!',
      visit: visitPayload
    });
  } catch (error: any) {
    console.error('Log field visit error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to log field visit' });
  }
};

// GET /api/field-visits
export const getFieldVisits = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { date, customerId, loanId, outcome, agentId } = req.query;

    const where: any = {
      companyId: user.companyId,
      entityType: 'FieldVisit',
      action: 'FIELD_VISIT_LOGGED'
    };

    if (date) {
      const { startOfDay, endOfDay } = getISTDateRange(String(date));
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    if (customerId) {
      where.entityId = Number(customerId);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    let visits = logs.map(l => {
      let data: any = {};
      try {
        data = JSON.parse(l.details || '{}');
      } catch {
        data = { remarks: l.details };
      }
      return {
        ...data,
        logId: l.id,
        photoData: l.photoData,
        createdAt: l.createdAt
      };
    });

    // Branch scoping
    if (isBranchScoped(user) && user.branchId != null) {
      visits = visits.filter(v => v.branchId == null || v.branchId === user.branchId);
    }

    if (loanId) {
      visits = visits.filter(v => v.loanId === Number(loanId));
    }

    if (outcome) {
      visits = visits.filter(v => v.outcome === String(outcome));
    }

    if (agentId) {
      visits = visits.filter(v => v.agentId === Number(agentId));
    }

    res.json({ success: true, visits });
  } catch (error: any) {
    console.error('Get field visits error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch field visits' });
  }
};

// GET /api/field-visits/ptp-calendar
export const getPtpCalendar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'FieldVisit',
        action: 'FIELD_VISIT_LOGGED'
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    const ptps: any[] = [];
    for (const l of logs) {
      if (!l.details) continue;
      try {
        const parsed = JSON.parse(l.details);
        if (parsed.outcome === 'ptp_taken' && parsed.ptpDate) {
          ptps.push({
            ...parsed,
            logId: l.id,
            photoData: l.photoData,
            createdAt: l.createdAt
          });
        }
      } catch {}
    }

    res.json({ success: true, ptps });
  } catch (error: any) {
    console.error('Get PTP calendar error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch PTP calendar' });
  }
};
