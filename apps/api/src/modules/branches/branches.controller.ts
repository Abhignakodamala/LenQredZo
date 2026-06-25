import prisma from '../../lib/prisma';
import { Response } from 'express';


export const getAllBranches = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const branches = await prisma.branch.findMany({
      where: { companyId },
      include: { customers: true, users: true },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats per branch
    const result = await Promise.all(branches.map(async (branch) => {
      const customerIds = branch.customers.map(c => c.id);
      const loans = await prisma.loan.findMany({
        where: { customerId: { in: customerIds.length ? customerIds : [-1] } }
      });
      const payments = await prisma.payment.findMany({
        where: { loanId: { in: loans.map(l => l.id).length ? loans.map(l => l.id) : [-1] } }
      });

      const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
      const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

      return {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        customerCount: branch.customers.length,
        staffCount: branch.users.length,
        loanCount: loans.length,
        totalDisbursed,
        totalCollected
      };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createBranch = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Branch name is required' });

    const branch = await prisma.branch.create({
      data: { name, address, phone, companyId }
    });
    res.status(201).json({ message: 'Branch created', branch });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateBranch = async (req: any, res: Response) => {
  try {
    const branch = await prisma.branch.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json({ message: 'Branch updated', branch });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
