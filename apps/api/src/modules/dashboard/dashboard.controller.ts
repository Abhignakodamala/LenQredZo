import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;

    const loans = await prisma.loan.findMany({ where: { companyId } });
    const customers = await prisma.customer.findMany({ where: { companyId } });
    const payments = await prisma.payment.findMany({
      where: { loan: { companyId } }
    });

    const totalDisbursed = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
    const activeCustomers = customers.length;
    const activeLoans = loans.filter(l => l.status === 'active').length;

    const recentLoans = await prisma.loan.findMany({
      where: { companyId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      totalDisbursed,
      totalCollections,
      activeCustomers,
      activeLoans,
      totalLoans: loans.length,
      recentLoans
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};