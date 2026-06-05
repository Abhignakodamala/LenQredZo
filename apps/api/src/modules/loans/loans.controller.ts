import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const calculateEMI = (principal: number, rate: number, tenure: number) => {
  const monthlyRate = rate / 12 / 100;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi);
};

export const createLoan = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const { customerId, type, amount, interestRate, tenure } = req.body;

    const loan = await prisma.loan.create({
      data: { customerId, type, amount, interestRate, tenure, status: 'active', companyId }
    });

    const emiAmount = calculateEMI(amount, interestRate, tenure);
    const emis = [];
    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      emis.push({ loanId: loan.id, amount: emiAmount, dueDate, status: 'pending' });
    }

    await prisma.eMI.createMany({ data: emis });

    res.status(201).json({ message: 'Loan created with EMI schedule', loan, emiAmount });
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
      if (emi.status !== 'paid' && new Date(emi.dueDate) < today) {
        display = 'overdue';
      }
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