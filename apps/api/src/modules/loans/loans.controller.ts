import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';

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

    // Calculate processing fee deduction
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
    res.json({ message: 'Loan status updated', loan });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const markEmiPaid = async (req: any, res: Response) => {
  try {
    const emiId = Number(req.params.emiId);
    const { collectPenalty = false } = req.body;

    const emi = await prisma.eMI.findUnique({
      where: { id: emiId },
      include: { loan: true }
    });
    if (!emi) return res.status(404).json({ message: 'EMI not found' });

    const today = new Date();
    const penaltyAmount = collectPenalty ? calculatePenalty(emi, emi.loan, today) : 0;
    const totalAmount = emi.amount + penaltyAmount;

    await prisma.eMI.update({
      where: { id: emiId },
      data: { status: 'paid', penalty: penaltyAmount, penaltyPaid: collectPenalty }
    });

    await prisma.payment.create({
      data: {
        loanId: emi.loanId, amount: totalAmount,
        method: req.body.method || 'cash',
        status: 'completed', paidAt: new Date()
      }
    });

    // Auto-complete loan if all EMIs are paid
    const remainingEmis = await prisma.eMI.count({
      where: { loanId: emi.loanId, status: { not: 'paid' } }
    });

    if (remainingEmis === 0) {
      await prisma.loan.update({
        where: { id: emi.loanId },
        data: { status: 'completed' }
      });
    }

    res.json({ message: 'EMI marked as paid', emiAmount: emi.amount, penaltyAmount, totalAmount, loanCompleted: remainingEmis === 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
      const isOverdue = emi.status !== 'paid' && new Date(emi.dueDate) < today;
      const status = emi.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';
      const daysOverdue = isOverdue
        ? Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000)
        : 0;
      const penalty = calculatePenalty(emi, emi.loan, today);

      return {
        id: emi.id,
        customerName: emi.loan.customer?.name,
        loanId: emi.loan.id,
        dueDate: emi.dueDate,
        amount: emi.amount,
        penalty,
        totalDue: emi.amount + penalty,
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