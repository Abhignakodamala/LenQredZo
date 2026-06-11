import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [loans, customers, payments, allEmis, branches] = await Promise.all([
      prisma.loan.findMany({ where: { companyId } }),
      prisma.customer.findMany({ where: { companyId } }),
      prisma.payment.findMany({ where: { loan: { companyId } } }),
      prisma.eMI.findMany({
        where: { loan: { companyId } },
        include: { loan: { include: { customer: true } } }
      }),
      prisma.branch.findMany({ where: { companyId } })
    ]);

    // === BASIC STATS ===
    const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
    const totalCollections = payments.reduce((s, p) => s + p.amount, 0);
    const activeCustomers = customers.length;
    const activeLoans = loans.filter(l => l.status === 'active').length;
    const netProfit = Math.round(totalCollections * 0.15);

    // === MONTH OVER MONTH CHANGE ===
    const thisMonthDisbursed = loans.filter(l => new Date(l.createdAt) >= startOfMonth).reduce((s, l) => s + l.amount, 0);
    const lastMonthDisbursed = loans.filter(l => new Date(l.createdAt) >= startOfLastMonth && new Date(l.createdAt) <= endOfLastMonth).reduce((s, l) => s + l.amount, 0);
    const thisMonthCollected = payments.filter(p => p.paidAt && new Date(p.paidAt) >= startOfMonth).reduce((s, p) => s + p.amount, 0);
    const lastMonthCollected = payments.filter(p => p.paidAt && new Date(p.paidAt) >= startOfLastMonth && new Date(p.paidAt) <= endOfLastMonth).reduce((s, p) => s + p.amount, 0);

    const disbursedChange = lastMonthDisbursed > 0 ? Number(((thisMonthDisbursed - lastMonthDisbursed) / lastMonthDisbursed * 100).toFixed(1)) : null;
    const collectionChange = lastMonthCollected > 0 ? Number(((thisMonthCollected - lastMonthCollected) / lastMonthCollected * 100).toFixed(1)) : null;

    // === NPA ANALYSIS ===
    let overdueAmount = 0;
    const npaChartData = [
      { name: '0-30 Days', value: 0, fill: '#3b82f6' },
      { name: '31-60 Days', value: 0, fill: '#f59e0b' },
      { name: '61-90 Days', value: 0, fill: '#f97316' },
      { name: '90+ Days', value: 0, fill: '#ef4444' }
    ];
    allEmis.forEach(emi => {
      if (emi.status !== 'paid') {
        const days = Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000);
        if (days > 0) {
          overdueAmount += emi.amount;
          if (days <= 30) npaChartData[0].value += emi.amount;
          else if (days <= 60) npaChartData[1].value += emi.amount;
          else if (days <= 90) npaChartData[2].value += emi.amount;
          else npaChartData[3].value += emi.amount;
        }
      }
    });
    const npaPercentage = totalDisbursed > 0 ? Number(((overdueAmount / totalDisbursed) * 100).toFixed(2)) : 0;

    // === COLLECTION EFFICIENCY ===
    const dueEmis = allEmis.filter(e => new Date(e.dueDate) <= today);
    const collectionEfficiency = dueEmis.length > 0
      ? Number(((dueEmis.filter(e => e.status === 'paid').length / dueEmis.length) * 100).toFixed(1))
      : 0;

    // === AI INSIGHTS ===
    const customerOverdueMap: any = {};
    allEmis.forEach(emi => {
      if (emi.status !== 'paid' && new Date(emi.dueDate) < today) {
        const id = emi.loan.customer?.id;
        if (id) customerOverdueMap[id] = (customerOverdueMap[id] || 0) + 1;
      }
    });
    const highRiskCount = Object.values(customerOverdueMap).filter((v: any) => v >= 2).length;
    const topUpEligible = loans.filter(loan => {
      const loanEmis = allEmis.filter(e => e.loanId === loan.id);
      const paid = loanEmis.filter(e => e.status === 'paid').length;
      return loanEmis.length > 0 && paid / loanEmis.length >= 0.5;
    }).length;

    const aiInsights = [
      {
        icon: '⚠️', title: 'High risk of default',
        description: `${highRiskCount} customers`,
        level: highRiskCount > 5 ? 'High' : highRiskCount > 0 ? 'Medium' : 'Low',
        levelColor: highRiskCount > 5 ? '#dc2626' : highRiskCount > 0 ? '#d97706' : '#16a34a',
        levelBg: highRiskCount > 5 ? '#fee2e2' : highRiskCount > 0 ? '#fef3c7' : '#dcfce7'
      },
      {
        icon: '📊', title: 'Collection efficiency',
        description: `${collectionEfficiency}% this month`,
        level: collectionEfficiency >= 80 ? 'Good' : 'Needs Attention',
        levelColor: collectionEfficiency >= 80 ? '#16a34a' : '#dc2626',
        levelBg: collectionEfficiency >= 80 ? '#dcfce7' : '#fee2e2'
      },
      {
        icon: '💡', title: 'Loans eligible for top-up',
        description: `${topUpEligible} customers`,
        level: 'Opportunity',
        levelColor: '#1e40af', levelBg: '#eff6ff'
      }
    ];

    // === BRANCH PERFORMANCE ===
    const branchStats = await Promise.all(branches.map(async branch => {
      const branchCusts = await prisma.customer.findMany({ where: { branchId: branch.id } });
      const custIds = branchCusts.map(c => c.id);
      const branchLoans = loans.filter(l => custIds.includes(l.customerId));
      const branchTotal = branchLoans.reduce((s, l) => s + l.amount, 0);
      const branchPayments = payments.filter(p => branchLoans.map(l => l.id).includes(p.loanId));
      const paidTotal = branchPayments.reduce((s, p) => s + p.amount, 0);
      const efficiency = branchTotal > 0 ? Math.round((paidTotal / branchTotal) * 100) : 0;
      return { name: branch.name, totalDisbursed: branchTotal, collected: paidTotal, efficiency };
    }));
    branchStats.sort((a, b) => b.totalDisbursed - a.totalDisbursed);

    // === PORTFOLIO + RECENT LOANS ===
    const portfolio: any = {};
    loans.forEach(l => { portfolio[l.type] = (portfolio[l.type] || 0) + l.amount; });
    const portfolioData = Object.keys(portfolio).map(type => ({ name: type, value: portfolio[type] }));

    const recentLoans = await prisma.loan.findMany({
      where: { companyId }, include: { customer: true },
      orderBy: { createdAt: 'desc' }, take: 5
    });

    res.json({
      totalDisbursed, totalCollections, activeCustomers, activeLoans,
      totalLoans: loans.length, npaPercentage, netProfit,
      disbursedChange, collectionChange, collectionEfficiency,
      recentLoans, portfolioData, npaChartData, aiInsights,
      branchPerformance: branchStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};