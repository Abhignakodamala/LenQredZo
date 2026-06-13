import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';

const prisma = new PrismaClient();

// --- PII helpers: decrypt + mask before sending to the browser ---
function maskCustomer(c: any) {
  if (!c) return c;
  return {
    ...c,
    aadhar: c.aadhar ? maskAadhaar(decrypt(c.aadhar)) : '',
    pan: c.pan ? maskPan(decrypt(c.pan)) : ''
  };
}

function maskGuarantor(g: any) {
  if (!g) return g;
  return {
    ...g,
    aadhar: g.aadhar ? maskAadhaar(decrypt(g.aadhar)) : '',
    pan: g.pan ? maskPan(decrypt(g.pan)) : ''
  };
}

const getPeriodsPerYear = (frequency: string) => {
  if (frequency === 'daily') return 365;
  if (frequency === 'weekly') return 52;
  return 12;
};

const calculateInstallment = (
  principal: number, rate: number, tenure: number,
  interestType: string, frequency: string, deductUpfront: boolean
): { emiAmount: number; disbursedAmount: number } => {
  let emiAmount: number;
  let disbursedAmount = principal;
  const periodsPerYear = getPeriodsPerYear(frequency);

  if (interestType === 'flat') {
    const totalInterest = principal * (rate / 100) * (tenure / periodsPerYear);
    if (deductUpfront) {
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      emiAmount = (principal + totalInterest) / tenure;
    }
  } else {
    const periodRate = rate / periodsPerYear / 100;
    if (deductUpfront) {
      const totalInterest = principal * (rate / 100) * (tenure / periodsPerYear);
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      emiAmount = periodRate === 0
        ? principal / tenure
        : (principal * periodRate * Math.pow(1 + periodRate, tenure)) / (Math.pow(1 + periodRate, tenure) - 1);
    }
  }

  return { emiAmount: Math.round(emiAmount), disbursedAmount: Math.round(disbursedAmount) };
};

const getNextDueDate = (startDate: Date, index: number, frequency: string): Date => {
  const date = new Date(startDate);
  if (frequency === 'daily') date.setDate(date.getDate() + index);
  else if (frequency === 'weekly') date.setDate(date.getDate() + index * 7);
  else date.setMonth(date.getMonth() + index);
  return date;
};

const calculatePenalty = (emi: any, loan: any, today: Date): number => {
  if (emi.status === 'paid' || new Date(emi.dueDate) >= today) return 0;
  const daysOverdue = Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000);
  if (loan.penaltyType === 'fixed') return loan.penaltyValue;
  if (loan.penaltyType === 'percentage') return Math.round(emi.amount * loan.penaltyValue / 100);
  if (loan.penaltyType === 'daily') return Math.round(daysOverdue * loan.penaltyValue);
  return 0;
};

export const createLoan = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const {
      customerId, type, amount, interestRate,
      interestType = 'percentage', frequency = 'monthly',
      tenure, deductUpfront = false,
      processingFee = 0, processingFeeType = 'percentage',
      penaltyType = 'none', penaltyValue = 0,
      guarantors = []
    } = req.body;

    if (!guarantors || guarantors.length === 0) {
      return res.status(400).json({ message: 'At least one guarantor is required' });
    }

    const { emiAmount, disbursedAmount: baseDisburse } = calculateInstallment(
      amount, interestRate, tenure, interestType, frequency, deductUpfront
    );

    const processingFeeAmount = processingFeeType === 'percentage'
      ? Math.round(amount * processingFee / 100)
      : Math.round(processingFee);

    const finalDisbursed = baseDisburse - processingFeeAmount;

    const loan = await prisma.loan.create({
      data: {
        customerId, type, amount, disbursedAmount: finalDisbursed,
        interestRate, interestType, frequency,
        deductUpfront, tenure, status: 'active', companyId,
        processingFee: processingFeeAmount,
        processingFeeType, penaltyType, penaltyValue
      }
    });

    const startDate = new Date();
    const emis = [];
    for (let i = 1; i <= tenure; i++) {
      emis.push({
        loanId: loan.id, amount: emiAmount,
        dueDate: getNextDueDate(startDate, i, frequency),
        status: 'pending'
      });
    }
    await prisma.eMI.createMany({ data: emis });

    // Save guarantors — Aadhaar/PAN encrypted at rest
    await prisma.guarantor.createMany({
      data: guarantors.map((g: any) => ({
        loanId: loan.id,
        name: g.name,
        phone: g.phone,
        address: g.address || null,
        aadhar: g.aadhar ? encrypt(g.aadhar) : null,
        pan: g.pan ? encrypt(g.pan) : null,
        relationship: g.relationship || null,
        type: g.type || 'guarantor'
      }))
    });

    await logAudit({
      req, action: 'CREATE_LOAN', entityType: 'Loan', entityId: loan.id,
      details: `Created ${type} loan LN${1000 + loan.id} of ₹${amount} for customer #${customerId}`
    });

    res.status(201).json({ message: 'Loan created successfully', loan, emiAmount, disbursedAmount: finalDisbursed, processingFeeAmount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getAllLoans = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const loans = await prisma.loan.findMany({
      where: { companyId },
      include: { customer: true, emis: true }
    });
    res.json(loans.map(l => ({ ...l, customer: maskCustomer(l.customer) })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLoanById = async (req: any, res: Response) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        customer: true,
        emis: { orderBy: { dueDate: 'asc' } },
        payments: true,
        guarantors: true
      }
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    const safe = {
      ...loan,
      customer: maskCustomer(loan.customer),
      guarantors: (loan.guarantors || []).map(maskGuarantor)
    };
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateLoanStatus = async (req: any, res: Response) => {
  try {
    const loan = await prisma.loan.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status }
    });
    await logAudit({
      req, action: 'UPDATE_LOAN_STATUS', entityType: 'Loan', entityId: loan.id,
      details: `Loan LN${1000 + loan.id} status changed to ${req.body.status}`
    });
    res.json({ message: 'Loan status updated', loan });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const markEmiPaid = async (req: any, res: Response) => {
  try {
    const emiId = Number(req.params.emiId);
    const { collectPenalty = false } = req.body;
    const method = (req.body.method || 'cash').toLowerCase();
    const reference = (req.body.reference || '').trim();

    // Digital methods need a reference (proof). Cash is allowed without one.
    const digitalMethods = ['upi', 'bank', 'cheque', 'card'];
    if (digitalMethods.includes(method) && !reference) {
      return res.status(400).json({ message: `A reference / transaction ID is required for ${method} payments` });
    }
    const verified = method !== 'cash' && reference.length > 0;

    const emi = await prisma.eMI.findUnique({
      where: { id: emiId },
      include: { loan: true }
    });
    if (!emi) return res.status(404).json({ message: 'EMI not found' });
    if (emi.status === 'paid') return res.status(400).json({ message: 'EMI is already fully paid' });

    const alreadyPaid = emi.paidAmount || 0;
    const remaining = emi.amount - alreadyPaid;

    // Amount being paid this time. If the frontend sends nothing, default to clearing the full remaining balance.
    const payAmount = req.body.amount != null ? Math.round(Number(req.body.amount)) : remaining;

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid payment amount' });
    }
    if (payAmount > remaining) {
      return res.status(400).json({ message: `Amount exceeds the remaining balance of ₹${remaining.toLocaleString('en-IN')}` });
    }

    const newPaid = alreadyPaid + payAmount;
    const fullyCleared = newPaid >= emi.amount;

    // Penalty is only collected when the EMI is fully cleared (v1 rule).
    const today = new Date();
    const penaltyAmount = (fullyCleared && collectPenalty) ? calculatePenalty(emi, emi.loan, today) : 0;
    const paymentTotal = payAmount + penaltyAmount;

    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.eMI.findUnique({ where: { id: emiId } });
      if (!fresh || fresh.status === 'paid') {
        throw new Error('ALREADY_PAID');
      }

      await tx.eMI.update({
        where: { id: emiId },
        data: {
          paidAmount: newPaid,
          status: fullyCleared ? 'paid' : 'partial',
          ...(fullyCleared ? { penalty: penaltyAmount, penaltyPaid: collectPenalty } : {})
        }
      });

      await tx.payment.create({
        data: {
          loanId: emi.loanId, amount: paymentTotal,
          method, reference: reference || null, verified,
          status: 'completed', paidAt: new Date()
        }
      });

      const remainingEmis = await tx.eMI.count({
        where: { loanId: emi.loanId, status: { not: 'paid' } }
      });

      let loanCompleted = false;
      if (remainingEmis === 0) {
        await tx.loan.update({
          where: { id: emi.loanId },
          data: { status: 'completed' }
        });
        loanCompleted = true;
      }

      return { loanCompleted };
    });

    const partialNote = fullyCleared ? '' : ` (partial — ₹${(emi.amount - newPaid).toLocaleString('en-IN')} still due)`;
    await logAudit({
      req, action: 'MARK_EMI_PAID', entityType: 'EMI', entityId: emiId,
      details: `Collected ₹${paymentTotal.toLocaleString('en-IN')} via ${method}${reference ? ' (ref: ' + reference + ')' : ''}${method === 'cash' ? ' [unverified cash]' : ''} on loan LN${1000 + emi.loanId}${partialNote}${result.loanCompleted ? ' — loan completed' : ''}`
    });

    res.json({
      message: fullyCleared ? 'EMI fully paid' : 'Partial payment recorded',
      payAmount,
      penaltyAmount,
      paymentTotal,
      paidAmount: newPaid,
      remaining: emi.amount - newPaid,
      status: fullyCleared ? 'paid' : 'partial',
      method,
      verified,
      loanCompleted: result.loanCompleted
    });
  } catch (error: any) {
    if (error?.message === 'ALREADY_PAID') {
      return res.status(400).json({ message: 'EMI is already fully paid' });
    }
    console.error('MARK EMI PAID ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCollections = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const emis = await prisma.eMI.findMany({
      where: { loan: { companyId } },
      include: { loan: { include: { customer: true } } },
      orderBy: { dueDate: 'asc' }
    });

    const today = new Date();
    const result = emis.map(emi => {
      const paidAmount = emi.paidAmount || 0;
      const remaining = emi.amount - paidAmount;

      const isOverdue = emi.status !== 'paid' && new Date(emi.dueDate) < today;
      // status: paid | partial | overdue | pending
      let status: string;
      if (emi.status === 'paid') status = 'paid';
      else if (paidAmount > 0) status = 'partial';
      else if (isOverdue) status = 'overdue';
      else status = 'pending';

      const daysOverdue = isOverdue
        ? Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000)
        : 0;

      // Penalty only applies to the still-due remainder, and only when not fully paid.
      const penalty = emi.status === 'paid' ? 0 : calculatePenalty(emi, emi.loan, today);

      return {
        id: emi.id,
        customerName: emi.loan.customer?.name,
        loanId: emi.loan.id,
        dueDate: emi.dueDate,
        amount: emi.amount,
        paidAmount,
        remaining,
        penalty,
        totalDue: remaining + penalty,
        daysOverdue,
        status,
        penaltyType: emi.loan.penaltyType,
        penaltyPaid: emi.penaltyPaid
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getPayments = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const payments = await prisma.payment.findMany({
      where: { loan: { companyId } },
      include: { loan: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' }
    });
    res.json(payments.map(p => ({
      ...p,
      loan: p.loan ? { ...p.loan, customer: maskCustomer((p.loan as any).customer) } : p.loan
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};