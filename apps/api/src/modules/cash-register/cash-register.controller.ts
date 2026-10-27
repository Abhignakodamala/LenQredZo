import { Response } from 'express';
import prisma from '../../lib/prisma';
import { logAudit } from '../../utils/audit';
import { isBranchScoped, paymentScope } from '../../utils/scoping';

// IST Time Helper (Indian Standard Time UTC+5:30)
const getISTDateRange = (dateStr?: string) => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const targetDateStr = dateStr || istNow.toISOString().slice(0, 10);

  const startOfDay = new Date(`${targetDateStr}T00:00:00+05:30`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999+05:30`);
  return { startOfDay, endOfDay, dateStr: targetDateStr };
};

// Helper to get structured handovers from AuditLog
const getParsedHandovers = async (companyId: number, branchId?: number | null) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: 'CashHandover',
      action: { in: ['CASH_HANDOVER_INITIATED', 'CASH_HANDOVER_ACCEPTED', 'CASH_HANDOVER_REJECTED'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  const map = new Map<string, any>();
  for (const log of logs) {
    if (!log.details) continue;
    try {
      const data = JSON.parse(log.details);
      if (!data.handoverId) continue;

      if (!map.has(data.handoverId)) {
        map.set(data.handoverId, {
          ...data,
          lastAction: log.action,
          lastUpdatedAt: log.createdAt
        });
      } else {
        const existing = map.get(data.handoverId);
        // If existing is already accepted/settled, preserve settled status
        if (existing.status === 'settled') {
          map.set(data.handoverId, { ...data, ...existing });
        } else {
          map.set(data.handoverId, { ...existing, ...data });
        }
      }
    } catch {}
  }

  const all = Array.from(map.values());
  if (branchId != null) {
    return all.filter((h) => h.branchId == null || h.branchId === branchId);
  }
  return all;
};

// GET /api/cash-register/summary
export const getCashRegisterSummary = async (req: any, res: Response) => {
  try {
    const { date } = req.query;
    const { startOfDay, endOfDay, dateStr } = getISTDateRange(date as string);
    const user = req.user;
    const companyId = user.companyId;
    const branchId = isBranchScoped(user) ? user.branchId : null;

    // 1. Fetch cash payments within date range
    const cashPayments = await prisma.payment.findMany({
      where: {
        ...paymentScope(user),
        method: 'cash',
        paidAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        loan: {
          include: {
            customer: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });

    // 2. Fetch associated EMI payment audit logs to identify which staff collected each cash payment
    const paymentAuditLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        action: 'MARK_EMI_PAID',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map each cash payment to its collector
    const collectionsWithStaff = cashPayments.map((p) => {
      const matchingAudit = paymentAuditLogs.find((a) =>
        a.entityId === p.loanId ||
        (a.details && (a.details.includes(`LN${1000 + p.loanId}`) || a.details.includes(`loan LN${1000 + p.loanId}`)))
      );
      const collectorId = matchingAudit?.userId ?? null;
      const collectorName = matchingAudit?.userName ?? 'Branch Operations';

      return {
        id: p.id,
        loanId: p.loanId,
        loanRef: `LN${1000 + p.loanId}`,
        customerName: p.loan?.customer?.name || 'Borrower',
        customerPhone: p.loan?.customer?.phone || '',
        amount: p.amount,
        paidAt: p.paidAt || p.createdAt,
        reference: p.reference,
        verified: p.verified,
        collectorId,
        collectorName
      };
    });

    // 3. Handover state from AuditLog
    const allHandovers = await getParsedHandovers(companyId, branchId);

    // Active pending handovers for the branch
    const pendingHandovers = allHandovers.filter((h) => h.status === 'pending');

    // Handovers settled on the requested date
    const settledTodayHandovers = allHandovers.filter(
      (h) => h.status === 'settled' && h.settledAt && h.settledAt >= startOfDay.toISOString() && h.settledAt <= endOfDay.toISOString()
    );

    // Cumulative settled handovers (all time) for vault balance estimation
    const allSettledHandovers = allHandovers.filter((h) => h.status === 'settled');
    const cumulativeVaultInflow = allSettledHandovers.reduce((s, h) => s + Number(h.totalAmount || 0), 0);

    // Total branch cash collected today
    const branchTotalCashCollectedToday = collectionsWithStaff.reduce((s, c) => s + Number(c.amount || 0), 0);

    // Current staff specific metrics
    const myCollections = collectionsWithStaff.filter(
      (c) => c.collectorId === user.userId || (!c.collectorId && ['collection_agent', 'loan_officer'].includes(user.role))
    );
    const myCollectedToday = myCollections.reduce((s, c) => s + Number(c.amount || 0), 0);

    const mySettledToday = settledTodayHandovers
      .filter((h) => h.agentId === user.userId)
      .reduce((s, h) => s + Number(h.totalAmount || 0), 0);

    const myActivePendingHandover = pendingHandovers.find((h) => h.agentId === user.userId) || null;

    const myPendingHandoverAmount = myActivePendingHandover ? Number(myActivePendingHandover.totalAmount || 0) : 0;
    const myCashInHand = Math.max(0, myCollectedToday - mySettledToday - myPendingHandoverAmount);

    // 4. Eligible cash receivers (Cashiers, Branch Managers, Owners)
    const eligibleReceivers = await prisma.user.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {}),
        role: { in: ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant', 'cashier'] }
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        branchId: true
      }
    });

    res.json({
      success: true,
      date: dateStr,
      user: {
        id: user.userId,
        name: user.name,
        role: user.role,
        branchId: user.branchId
      },
      agentMetrics: {
        collectedToday: myCollectedToday,
        settledToday: mySettledToday,
        pendingHandoverAmount: myPendingHandoverAmount,
        cashInHand: myCashInHand,
        activeHandover: myActivePendingHandover,
        myCollections
      },
      branchMetrics: {
        branchTotalCashCollectedToday,
        totalSettledToVaultToday: settledTodayHandovers.reduce((s, h) => s + Number(h.totalAmount || 0), 0),
        pendingHandoversCount: pendingHandovers.length,
        pendingHandoversAmount: pendingHandovers.reduce((s, h) => s + Number(h.totalAmount || 0), 0),
        cumulativeVaultBalance: cumulativeVaultInflow,
        pendingHandovers,
        settledTodayHandovers
      },
      eligibleReceivers
    });
  } catch (error: any) {
    console.error('Cash register summary error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch cash register summary' });
  }
};

// POST /api/cash-register/handover/initiate
export const initiateCashHandover = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const companyId = user.companyId;
    const branchId = isBranchScoped(user) ? user.branchId : null;

    const {
      receiverId,
      totalAmount,
      denominations = {},
      notes = ''
    } = req.body;

    const parsedTotal = Math.round(Number(totalAmount));
    if (!parsedTotal || parsedTotal <= 0) {
      return res.status(400).json({ success: false, error: 'Total handover amount must be greater than zero.' });
    }

    if (!receiverId) {
      return res.status(400).json({ success: false, error: 'Please select a receiving Branch Cashier or Manager.' });
    }

    // Verify receiver exists and belongs to the company
    const receiver = await prisma.user.findFirst({
      where: {
        id: Number(receiverId),
        companyId
      }
    });

    if (!receiver) {
      return res.status(404).json({ success: false, error: 'Selected receiving staff member not found.' });
    }

    // Denomination calculation
    const d500 = Number(denominations.count500 || 0);
    const d200 = Number(denominations.count200 || 0);
    const d100 = Number(denominations.count100 || 0);
    const d50 = Number(denominations.count50 || 0);
    const d20 = Number(denominations.count20 || 0);
    const d10 = Number(denominations.count10 || 0);
    const coins = Number(denominations.coins || 0);

    const calculatedTotal =
      (d500 * 500) +
      (d200 * 200) +
      (d100 * 100) +
      (d50 * 50) +
      (d20 * 20) +
      (d10 * 10) +
      coins;

    const difference = calculatedTotal - parsedTotal;

    // Generate unique Handover ID and 4-digit verification code
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const handoverId = `CHO-${datePrefix}-${randomSuffix}`;
    const verificationCode = String(Math.floor(1000 + Math.random() * 9000));

    const handoverPayload = {
      handoverId,
      status: 'pending',
      agentId: user.userId,
      agentName: user.name || 'Field Agent',
      agentRole: user.role,
      receiverId: receiver.id,
      receiverName: receiver.name,
      receiverRole: receiver.role,
      branchId,
      totalAmount: parsedTotal,
      denominationTotal: calculatedTotal,
      difference,
      denominations: {
        count500: d500,
        count200: d200,
        count100: d100,
        count50: d50,
        count20: d20,
        count10: d10,
        coins
      },
      verificationCode,
      notes: notes || 'Evening field collection handover to branch vault.',
      initiatedAt: now.toISOString()
    };

    // Log to AuditLog for permanent tamper-proof ledger tracking
    await logAudit({
      req,
      action: 'CASH_HANDOVER_INITIATED',
      entityType: 'CashHandover',
      details: JSON.stringify(handoverPayload)
    });

    res.json({
      success: true,
      message: `Cash handover of ₹${parsedTotal.toLocaleString('en-IN')} initiated! Share verification code ${verificationCode} with the cashier.`,
      handover: handoverPayload
    });
  } catch (error: any) {
    console.error('Initiate cash handover error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to initiate cash handover.' });
  }
};

// POST /api/cash-register/handover/accept
export const acceptCashHandover = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const companyId = user.companyId;
    const { handoverId, verificationCode, confirmedDenominations, cashierNotes = '' } = req.body;

    if (!handoverId || !verificationCode) {
      return res.status(400).json({ success: false, error: 'Handover ID and 4-digit verification code are required.' });
    }

    // Find the initiated handover log
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        entityType: 'CashHandover',
        action: 'CASH_HANDOVER_INITIATED'
      },
      orderBy: { createdAt: 'desc' }
    });

    let targetHandover: any = null;
    for (const log of auditLogs) {
      if (!log.details) continue;
      try {
        const parsed = JSON.parse(log.details);
        if (parsed.handoverId === handoverId) {
          targetHandover = parsed;
          break;
        }
      } catch {}
    }

    if (!targetHandover) {
      return res.status(404).json({ success: false, error: 'Pending handover record not found.' });
    }

    // Verify code
    if (String(targetHandover.verificationCode).trim() !== String(verificationCode).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please request the 4-digit code displayed on the field agent\'s screen.'
      });
    }

    // Check if already settled
    const settledLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        entityType: 'CashHandover',
        action: 'CASH_HANDOVER_ACCEPTED'
      }
    });

    for (const s of settledLogs) {
      if (s.details && s.details.includes(handoverId)) {
        return res.status(400).json({ success: false, error: 'This cash handover has already been accepted and settled.' });
      }
    }

    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const voucherNumber = `VR-${datePrefix}-${randomSuffix}`;

    const settledVoucher = {
      ...targetHandover,
      status: 'settled',
      voucherNumber,
      acceptedByUserId: user.userId,
      acceptedByName: user.name || 'Branch Cashier',
      acceptedByRole: user.role,
      settledAt: now.toISOString(),
      cashierNotes: cashierNotes || 'Physical currency notes counted and accepted into branch vault.',
      confirmedDenominations: confirmedDenominations || targetHandover.denominations
    };

    // Record settlement in AuditLog
    await logAudit({
      req,
      action: 'CASH_HANDOVER_ACCEPTED',
      entityType: 'CashHandover',
      details: JSON.stringify(settledVoucher)
    });

    res.json({
      success: true,
      message: `Cash handover accepted! ₹${Number(targetHandover.totalAmount).toLocaleString('en-IN')} deposited into branch vault.`,
      voucher: settledVoucher
    });
  } catch (error: any) {
    console.error('Accept cash handover error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to accept cash handover.' });
  }
};

// GET /api/cash-register/handovers/history
export const getHandoverHistory = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const companyId = user.companyId;
    const branchId = isBranchScoped(user) ? user.branchId : null;

    const handovers = await getParsedHandovers(companyId, branchId);

    res.json({
      success: true,
      handovers
    });
  } catch (error: any) {
    console.error('Handover history error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch handover history.' });
  }
};
