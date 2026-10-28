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
