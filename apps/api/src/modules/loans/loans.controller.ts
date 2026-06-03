import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const calculateEMI = (principal: number, rate: number, tenure: number) => {
  const monthlyRate = rate / 12 / 100;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi);
};

export const createLoan = async (req: Request, res: Response) => {
  try {
    const { customerId, type, amount, interestRate, tenure } = req.body;

    const loan = await prisma.loan.create({
      data: { customerId, type, amount, interestRate, tenure, status: 'active' }
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

export const getAllLoans = async (req: Request, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      include: { customer: true, emis: true }
    });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLoanById = async (req: Request, res: Response) => {
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

export const updateLoanStatus = async (req: Request, res: Response) => {
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