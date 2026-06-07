import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  let disbursedAmount: number = principal;

  if (interestType === 'flat') {
    const totalInterest = rate;
    if (deductUpfront) {
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      emiAmount = (principal + totalInterest) / tenure;
    }
  } else {
    const periodsPerYear = getPeriodsPerYear(frequency);
    const periodRate = rate / periodsPerYear / 100;
    if (deductUpfront) {
      const totalInterest = principal * (rate / 100) * (tenure / periodsPerYear);
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      if (periodRate === 0) {
        emiAmount = principal / tenure;
      } else {
        emiAmount = (principal * periodRate * Math.pow(1 + periodRate, tenure)) /
                    (Math.pow(1 + periodRate, tenure) - 1);
      }
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

export const createLoan = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const {
      customerId, type, amount, interestRate,
      interestType = 'percentage', frequency = 'monthly',
      tenure, deductUpfront = false
    } = req.body;

    const { emiAmount, disbursedAmount } = calculateInstallment(
      amount, interestRate, tenure, interestType, frequency, deductUpfront
    );

    const loan = await prisma.loan.create({
      data: {
        customerId, type, amount, disbursedAmount,
        interestRate, interestType, frequency,
        deductUpfront, tenure, status: 'active', companyId
      }
    });

    const startDate = new Date();
    const emis = [];
    for (let i = 1; i <= tenure; i++) {
      const dueDate = getNextDueDate(startDate, i, frequency);
      emis.push({ loanId: loan.id, amount: emiAmount, dueDate, status: 'pending' });
    }

    await prisma.eMI.createMany({ data: emis });
    res.status(201).json({ message: 'Loan created successfully', loan, emiAmount, disbursedAmount });
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
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLoanById = async (req: any, res: Response) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: Number(req.params.id) },
      include: { customer: true, emis: true, payments: true }
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
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
    const emi = await prisma.eMI.update({
      where: { id: emiId },
      data: { status: 'paid' }
    });
    await prisma.payment.create({
      data: { loanId: emi.loanId, amount: emi.amount, method: 'cash', status: 'completed', paidAt: new Date() }
    });
    res.json({ message: 'EMI marked as paid', emi });
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
      let display = emi.status;
      if (emi.status !== 'paid' && new Date(emi.dueDate) < today) display = 'overdue';
      return {
        id: emi.id,
        customerName: emi.loan.customer?.name,
        loanId: emi.loan.id,
        dueDate: emi.dueDate,
        amount: emi.amount,
        status: display
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
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};