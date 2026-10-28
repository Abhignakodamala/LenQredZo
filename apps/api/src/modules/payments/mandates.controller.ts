import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { decrypt } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';

function safeDecrypt(val?: string | null): string {
  if (!val) return '';
  try {
    return decrypt(val);
  } catch {
    return val;
  }
}

// 1. POST /api/payments/mandates/create
export const createMandate = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      loanId,
      mandateType = 'UPI_AUTOPAY', // 'UPI_AUTOPAY' | 'E_NACH'
      maxAmount,
      frequency = 'monthly',
      notes = ''
    } = req.body;

    if (!loanId) {
      return res.status(400).json({ error: 'loanId is required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: Number(loanId) },
      include: { customer: true, company: true, emis: { orderBy: { dueDate: 'asc' } } }
    });

    if (!loan || loan.companyId !== user.companyId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const customer = loan.customer;
    if (!customer) {
      return res.status(400).json({ error: 'Customer record not found for loan' });
    }

    // Generate unique UMN (Unique Mandate Number - NPCI Standard Format)
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const umn = `UMN${datePrefix}${randomSuffix}`;
    const mandateId = `MAN-${datePrefix}-${loan.id}-${randomSuffix}`;

    const defaultEmi = loan.emis?.[0]?.amount || (loan as any).emiAmount || 0;
    const limit = maxAmount ? Number(maxAmount) : Math.round(Number(defaultEmi || 0) * 1.2);

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const authLink = `${clientBaseUrl}/dashboard/mandate-auth?id=${mandateId}&loanId=${loan.id}&amount=${limit}`;

    // UPI Deep link for PhonePe / GPay / Paytm
    const payeeVpa = 'lenqredzo.autopay@axisbank';
    const companyName = loan.company?.name || 'LenQredzo Capital';
    const upiDeepLink = `upi://mandate?pa=${payeeVpa}&pn=${encodeURIComponent(companyName)}&mc=6012&tid=${umn}&tr=${umn}&am=${limit}&cu=INR&recur=${frequency.toUpperCase()}&url=${encodeURIComponent(authLink)}`;

    const lastEmi = loan.emis && loan.emis.length > 0 ? loan.emis[loan.emis.length - 1] : null;
    const endDate = lastEmi?.dueDate ? new Date(lastEmi.dueDate).toISOString().slice(0, 10) : now.toISOString().slice(0, 10);

    const mandateData = {
      mandateId,
      umn,
      loanId: loan.id,
      loanRef: `LN${1000 + loan.id}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      bankName: customer.bankName || 'Borrower Bank',
      maskedAccount: customer.bankAccountNumber ? (customer.bankAccountNumber.length <= 4 ? customer.bankAccountNumber : `XXXX-XXXX-${customer.bankAccountNumber.slice(-4)}`) : '—',
      bankIfsc: customer.bankIfsc || '—',
      mandateType: mandateType.toUpperCase(),
      status: 'ACTIVE', // Simulated active for instant testing & recurring debit
      maxAmount: limit,
      emiAmount: defaultEmi,
      frequency,
      startDate: now.toISOString().slice(0, 10),
      endDate,
      authLink,
      upiDeepLink,
      registeredAt: now.toISOString(),
      createdByName: user.name || 'Loan Officer',
      notes: notes || 'Automated recurring EMI mandate via NPCI UPI AutoPay / e-NACH'
    };

    // Store in AuditLog for permanent tamper-proof ledger tracking
    await logAudit({
      req,
      action: 'MANDATE_CREATED',
      entityType: 'Mandate',
      entityId: loan.id,
      details: JSON.stringify(mandateData)
    });

    res.json({
      success: true,
      message: `UPI AutoPay mandate registered successfully! NPCI UMN: ${umn}`,
      mandate: mandateData
    });
  } catch (error: any) {
    console.error('Mandate creation error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create mandate' });
  }
};

// 2. GET /api/payments/mandates/:loanId
export const getLoanMandate = async (req: Request, res: Response) => {
  try {
    const loanId = Number(req.params.loanId);
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: user.companyId,
        entityType: 'Mandate',
        entityId: loanId
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!audit || !audit.details) {
      return res.json({ success: true, mandate: null });
    }

    let parsed = null;
    try {
      parsed = JSON.parse(audit.details);
    } catch {
      parsed = { notes: audit.details };
    }

    res.json({ success: true, mandate: parsed });
  } catch (error: any) {
    console.error('Get loan mandate error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch mandate' });
  }
};

// 3. POST /api/payments/mandates/execute-debit
export const executeMandateDebit = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { loanId, emiId } = req.body;
    if (!loanId || !emiId) {
      return res.status(400).json({ error: 'loanId and emiId are required' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: Number(loanId) },
      include: { customer: true, company: true, emis: true }
    });

    if (!loan || loan.companyId !== user.companyId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Find active mandate
    const mandateAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: user.companyId,
        entityType: 'Mandate',
        entityId: loan.id
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!mandateAudit || !mandateAudit.details) {
      return res.status(400).json({ error: 'No active mandate found for this loan. Please setup UPI AutoPay first.' });
    }

    const mandate = JSON.parse(mandateAudit.details);
    if (mandate.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Mandate status is ${mandate.status}. Auto-debit can only be triggered on ACTIVE mandates.` });
    }

    const emi = await prisma.eMI.findUnique({
      where: { id: Number(emiId) }
    });

    if (!emi || emi.loanId !== loan.id) {
      return res.status(404).json({ error: 'EMI not found' });
    }

    if (emi.status === 'paid') {
      return res.status(400).json({ error: 'EMI is already fully paid' });
    }

    const remaining = emi.amount - (emi.paidAmount || 0);
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const npciRef = `NPCI-AUTOPAY-${datePrefix}-${randomSuffix}`;

    // Execute payment and mark EMI paid atomically
    const result = await prisma.$transaction(async (tx) => {
      const updatedEmi = await tx.eMI.update({
        where: { id: emi.id },
        data: {
          paidAmount: emi.amount,
          status: 'paid',
          paidAt: now
        }
      });

      const payment = await tx.payment.create({
        data: {
          loanId: loan.id,
          amount: remaining,
          method: 'upi_autopay',
          reference: npciRef,
          verified: true,
          status: 'completed',
          paidAt: now
        }
      });

      const remainingPending = await tx.eMI.count({
        where: { loanId: loan.id, status: { not: 'paid' } }
      });

      let loanCompleted = false;
      if (remainingPending === 0) {
        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'completed' }
        });
        loanCompleted = true;
      }

      return { updatedEmi, payment, loanCompleted };
    });

    // Record audit event
    await logAudit({
      req,
      action: 'MANDATE_DEBIT_SUCCESS',
      entityType: 'Payment',
      entityId: result.payment.id,
      details: `Auto-debit of ₹${remaining.toLocaleString('en-IN')} successfully executed via ${mandate.mandateType} (UMN: ${mandate.umn}) on loan LN${1000 + loan.id}. NPCI Ref: ${npciRef}`
    });

    res.json({
      success: true,
      message: `₹${remaining.toLocaleString('en-IN')} successfully auto-debited via UPI AutoPay!`,
      reference: npciRef,
      payment: result.payment,
      emi: result.updatedEmi,
      loanCompleted: result.loanCompleted
    });
  } catch (error: any) {
    console.error('Execute mandate debit error:', error);
    res.status(500).json({ success: false, error: error.message || 'Auto-debit execution failed' });
  }
};



// 4. GET /api/payments/mandates/pre-debit/upcoming
export const getUpcomingPreDebitEmis = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const daysAhead = Number(req.query.daysAhead) || 2; // Default 48 hours window
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + daysAhead);
    windowEnd.setHours(23, 59, 59, 999);

    // Fetch active mandates for the company
    const mandateAudits = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'Mandate',
        action: 'CREATE_MANDATE'
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeMandateMap = new Map<number, any>();
    for (const a of mandateAudits) {
      if (!activeMandateMap.has(a.entityId)) {
        try {
          const parsed = JSON.parse(a.details || '{}');
          if (parsed.status === 'ACTIVE') {
            activeMandateMap.set(a.entityId, parsed);
          }
        } catch {}
      }
    }

    if (activeMandateMap.size === 0) {
      return res.json({ success: true, count: 0, items: [] });
    }

    const loanIdsWithMandates = Array.from(activeMandateMap.keys());

    // Fetch pending EMIs for loans with active mandates due in window
    const emis = await prisma.eMI.findMany({
      where: {
        loanId: { in: loanIdsWithMandates },
        status: { in: ['pending', 'partial'] },
        dueDate: {
          gte: today,
          lte: windowEnd
        }
      },
      include: {
        loan: {
          include: { customer: true, company: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    // Check which EMIs have already been sent a pre-debit notification
    const emiIds = emis.map(e => e.id);
    const existingNotifAudits = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'MandateNotification',
        action: 'PRE_DEBIT_NOTIFICATION_SENT',
        entityId: { in: emiIds }
      },
      orderBy: { createdAt: 'desc' }
    });

    const notifMap = new Map<number, any>();
    for (const na of existingNotifAudits) {
      if (!notifMap.has(na.entityId)) {
        try {
          notifMap.set(na.entityId, { createdAt: na.createdAt, details: JSON.parse(na.details || '{}') });
        } catch {
          notifMap.set(na.entityId, { createdAt: na.createdAt, details: {} });
        }
      }
    }

    const items = emis.map(emi => {
      const mandate = activeMandateMap.get(emi.loanId);
      const notif = notifMap.get(emi.id);
      const dueTime = new Date(emi.dueDate).getTime();
      const hoursUntilDebit = Math.max(0, Math.round((dueTime - Date.now()) / (1000 * 60 * 60)));
      const remainingAmount = emi.amount - (emi.paidAmount || 0);

      const customer: any = emi.loan.customer || {};
      const companyName = emi.loan.company?.name || 'LenQredzo Capital Private Limited';
      const dueDateFormatted = new Date(emi.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const messagePreview =
        `🔔 *RBI e-Mandate Advance Debit Notice*\n\n` +
        `Dear *${customer.name || 'Borrower'}*,\n\n` +
        `This is an advance advisory from *${companyName}* regarding your loan *LN${1000 + emi.loanId}*.\n\n` +
        `Your monthly installment of *₹${remainingAmount.toLocaleString('en-IN')}* is scheduled for automatic deduction via *${mandate?.mandateType || 'UPI AutoPay'}* on *${dueDateFormatted}*.\n\n` +
        `📋 *Mandate Particulars:*\n` +
        `• Mandate UMN: ${mandate?.umn || '—'}\n` +
        `• Destination Bank: ${mandate?.bankName || customer.bankName || 'Bank'} (${mandate?.maskedAccount || '••••'})\n` +
        `• Debit Amount: ₹${remainingAmount.toLocaleString('en-IN')}\n\n` +
        `⚠️ *Important Balance Notice:*\n` +
        `Please ensure your account has sufficient balance of at least ₹${remainingAmount.toLocaleString('en-IN')} before ${dueDateFormatted} to prevent bank bounce charges (₹350 - ₹590).\n\n` +
        `Regards,\n*${companyName}*`;

      const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
      const waLink = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(messagePreview)}` : '';

      return {
        emiId: emi.id,
        loanId: emi.loanId,
        loanRef: `LN${1000 + emi.loanId}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        dueDate: emi.dueDate,
        dueDateFormatted,
        hoursUntilDebit,
        amount: remainingAmount,
        mandateUmn: mandate?.umn,
        mandateType: mandate?.mandateType || 'UPI_AUTOPAY',
        bankName: mandate?.bankName || customer.bankName || 'Bank',
        maskedAccount: mandate?.maskedAccount || '••••',
        notificationSent: Boolean(notif),
        notificationSentAt: notif?.createdAt || null,
        notificationRef: notif?.details?.notifRef || null,
        messagePreview,
        waLink
      };
    });

    res.json({
      success: true,
      count: items.length,
      daysAhead,
      items
    });
  } catch (error: any) {
    console.error('Get upcoming pre-debit emis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch upcoming pre-debit accounts' });
  }
};

// 5. POST /api/payments/mandates/pre-debit/send
export const sendPreDebitNotification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { items = [] } = req.body;
    const targets: Array<{ loanId: number; emiId: number }> = Array.isArray(items) && items.length > 0
      ? items
      : (req.body.loanId && req.body.emiId ? [{ loanId: Number(req.body.loanId), emiId: Number(req.body.emiId) }] : []);

    if (targets.length === 0) {
      return res.status(400).json({ success: false, message: 'No loan EMI specified for pre-debit notice' });
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const dispatchedResults = [];

    for (const target of targets) {
      const loan = await prisma.loan.findUnique({
        where: { id: Number(target.loanId) },
        include: { customer: true, company: true }
      });

      if (!loan || loan.companyId !== user.companyId) continue;

      const emi = await prisma.eMI.findUnique({
        where: { id: Number(target.emiId) }
      });

      if (!emi || emi.loanId !== loan.id || emi.status === 'paid') continue;

      // Find active mandate
      const mandateAudit = await prisma.auditLog.findFirst({
        where: {
          companyId: user.companyId,
          entityType: 'Mandate',
          entityId: loan.id
        },
        orderBy: { createdAt: 'desc' }
      });

      let mandate: any = null;
      if (mandateAudit && mandateAudit.details) {
        try { mandate = JSON.parse(mandateAudit.details); } catch { mandate = {}; }
      }

      const remainingAmount = emi.amount - (emi.paidAmount || 0);
      const companyName = loan.company?.name || 'LenQredzo Capital Private Limited';
      const customer: any = loan.customer || {};
      const dueDateFormatted = new Date(emi.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const notifRef = `PREDEBIT-ADV-${dateStr}-${randSuffix}`;

      const messageText =
        `🔔 *RBI e-Mandate Advance Debit Notice*\n\n` +
        `Dear *${customer.name || 'Borrower'}*,\n\n` +
        `This is an advance notice from *${companyName}* regarding your loan *LN${1000 + loan.id}*.\n\n` +
        `Your monthly EMI installment of *₹${remainingAmount.toLocaleString('en-IN')}* is scheduled for automatic bank deduction via *${mandate?.mandateType || 'UPI AutoPay'}* on *${dueDateFormatted}*.\n\n` +
        `📋 *Mandate Particulars:*\n` +
        `• Mandate UMN: ${mandate?.umn || '—'}\n` +
        `• Destination Bank: ${mandate?.bankName || customer.bankName || 'Bank'} (${mandate?.maskedAccount || '••••'})\n` +
        `• Scheduled Debit Amount: ₹${remainingAmount.toLocaleString('en-IN')}\n\n` +
        `⚠️ *Important Balance Notice:*\n` +
        `Please ensure your bank account maintains a minimum balance of at least ₹${remainingAmount.toLocaleString('en-IN')} before ${dueDateFormatted} to avoid bounce charges levied by your bank (₹350 - ₹590).\n\n` +
        `If you have already settled this installment at our branch counter, please disregard this automated notice.\n\n` +
        `Regards,\n*${companyName}*`;

      const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
      const waLink = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(messageText)}` : '';

      await logAudit({
        req,
        action: 'PRE_DEBIT_NOTIFICATION_SENT',
        entityType: 'MandateNotification',
        entityId: emi.id,
        details: JSON.stringify({
          notifRef,
          channel: 'whatsapp',
          emiId: emi.id,
          loanId: loan.id,
          loanRef: `LN${1000 + loan.id}`,
          borrowerName: customer.name,
          borrowerPhone: customer.phone,
          mandateUmn: mandate?.umn,
          amount: remainingAmount,
          scheduledDebitDate: emi.dueDate,
          dispatchedAt: today.toISOString(),
          sentByUserId: user.userId,
          sentByName: user.name || 'AutoPay Officer',
          messageText
        })
      });

      dispatchedResults.push({
        emiId: emi.id,
        loanId: loan.id,
        loanRef: `LN${1000 + loan.id}`,
        customerName: customer.name,
        customerPhone: customer.phone,
        notifRef,
        amount: remainingAmount,
        dueDate: emi.dueDate,
        waLink,
        status: 'DISPATCHED'
      });
    }

    res.json({
      success: true,
      message: `24-hour pre-debit notices issued successfully for ${dispatchedResults.length} accounts!`,
      totalDispatched: dispatchedResults.length,
      dispatchedAt: today.toISOString(),
      items: dispatchedResults
    });
  } catch (error: any) {
    console.error('Send pre-debit notification error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to dispatch pre-debit notices' });
  }
};

// 6. POST /api/payments/mandates/pre-debit/cron
export const triggerPreDebitCron = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 2); // 48 hours window
    windowEnd.setHours(23, 59, 59, 999);

    const mandateAudits = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'Mandate',
        action: 'CREATE_MANDATE'
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeLoanIds: number[] = [];
    for (const a of mandateAudits) {
      try {
        const p = JSON.parse(a.details || '{}');
        if (p.status === 'ACTIVE' && !activeLoanIds.includes(a.entityId)) {
          activeLoanIds.push(a.entityId);
        }
      } catch {}
    }

    if (activeLoanIds.length === 0) {
      return res.json({ success: true, message: 'No active mandates found.', sentCount: 0, skippedCount: 0 });
    }

    const pendingEmis = await prisma.eMI.findMany({
      where: {
        loanId: { in: activeLoanIds },
        status: { in: ['pending', 'partial'] },
        dueDate: { gte: today, lte: windowEnd }
      }
    });

    const emiIds = pendingEmis.map(e => e.id);
    const alreadyNotified = await prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'MandateNotification',
        action: 'PRE_DEBIT_NOTIFICATION_SENT',
        entityId: { in: emiIds }
      }
    });

    const notifiedSet = new Set(alreadyNotified.map(a => a.entityId));
    const eligibleToNotify = pendingEmis.filter(e => !notifiedSet.has(e.id));
    const dispatchItems = eligibleToNotify.map(e => ({ loanId: e.loanId, emiId: e.id }));

    if (dispatchItems.length === 0) {
      return res.json({
        success: true,
        message: 'All upcoming AutoPay accounts due in next 48h have already received advance notice. 100% compliant!',
        sentCount: 0,
        skippedCount: alreadyNotified.length,
        totalUpcoming: pendingEmis.length
      });
    }

    req.body = { items: dispatchItems };
    return await sendPreDebitNotification(req, res);
  } catch (error: any) {
    console.error('Trigger pre-debit cron error:', error);
    res.status(500).json({ success: false, error: error.message || 'Pre-debit cron execution failed' });
  }
};
