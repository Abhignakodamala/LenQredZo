import prisma from '../../lib/prisma';
import { Response } from 'express';


export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET);
    const startOfMonth = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET);
    const startOfLastMonth = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth() - 1, 1) - IST_OFFSET);
    const endOfLastMonth = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET - 1000);
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
        const days = Math.floor((istNow.getTime() - new Date(emi.dueDate).getTime()) / 86400000);
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
    const dueEmis = allEmis.filter(e => new Date(e.dueDate) <= istNow);
    const collectionEfficiency = dueEmis.length > 0
      ? Number(((dueEmis.filter(e => e.status === 'paid').length / dueEmis.length) * 100).toFixed(1))
      : 0;

    // === AI INSIGHTS ===
    const customerOverdueMap: any = {};
    allEmis.forEach(emi => {
      if (emi.status !== 'paid' && new Date(emi.dueDate) < istNow) {
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

export const getAnalytics = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const loans = await prisma.loan.findMany({
      where: { companyId },
      include: { customer: true }
    });
    const payments = await prisma.payment.findMany({
      where: { loan: { companyId } }
    });
    const emis = await prisma.eMI.findMany({
      where: { loan: { companyId } }
    });

    // Monthly disbursement trend (last 6 months)
    const monthly: any = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthly[key] = { month: key, disbursed: 0, collected: 0 };
    }
    loans.forEach(l => {
      const key = new Date(l.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthly[key]) monthly[key].disbursed += l.amount;
    });
    payments.forEach(p => {
      if (!p.paidAt) return;
      const key = new Date(p.paidAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthly[key]) monthly[key].collected += p.amount;
    });
    const monthlyTrend = Object.values(monthly);

    // Loan type breakdown
    const typeMap: any = {};
    loans.forEach(l => {
      if (!typeMap[l.type]) typeMap[l.type] = { type: l.type, count: 0, amount: 0 };
      typeMap[l.type].count += 1;
      typeMap[l.type].amount += l.amount;
    });
    const loanTypeBreakdown = Object.values(typeMap);

    // Collection efficiency
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const dueEmis = emis.filter(e => new Date(e.dueDate) <= istNow);
    const paidDue = dueEmis.filter(e => e.status === 'paid').length;
    const collectionRate = dueEmis.length > 0 ? Math.round((paidDue / dueEmis.length) * 100) : 0;

    // Top customers by total loan value
    const custMap: any = {};
    loans.forEach(l => {
      const name = l.customer?.name || 'Unknown';
      if (!custMap[name]) custMap[name] = { name, loanCount: 0, totalAmount: 0 };
      custMap[name].loanCount += 1;
      custMap[name].totalAmount += l.amount;
    });
    const topCustomers = Object.values(custMap)
      .sort((a: any, b: any) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Status breakdown
    const statusMap: any = { active: 0, completed: 0, pending: 0 };
    loans.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });

    res.json({
      monthlyTrend,
      loanTypeBreakdown,
      collectionRate,
      topCustomers,
      statusBreakdown: statusMap,
      totalLoans: loans.length,
      avgLoanSize: loans.length > 0 ? Math.round(loans.reduce((s, l) => s + l.amount, 0) / loans.length) : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getTodayOverview = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    // Compute "today" in India time so day boundaries are correct regardless of server timezone.
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET);
    const startOfToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET);
    const endOfToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59) - IST_OFFSET);
    const emis = await prisma.eMI.findMany({
      where: { loan: { companyId } },
      include: { loan: { include: { customer: true } } },
      orderBy: { dueDate: 'asc' }
    });

    // EMIs due today
    const dueToday = emis
      .filter(e => e.status !== 'paid' && new Date(e.dueDate) >= startOfToday && new Date(e.dueDate) <= endOfToday)
      .map(e => ({
        id: e.id,
        customerName: e.loan.customer?.name,
        loanId: e.loan.id,
        amount: e.amount,
        dueDate: e.dueDate
      }));

    // Overdue EMIs
    const overdue = emis.filter(e => e.status !== 'paid' && new Date(e.dueDate) < startOfToday);
    const overdueAmount = overdue.reduce((s, e) => s + e.amount, 0);

    // Due-today total
    const dueTodayAmount = dueToday.reduce((s, e) => s + e.amount, 0);

    // Recent activity — last 5 payments
    const recentPayments = await prisma.payment.findMany({
      where: { loan: { companyId } },
      include: { loan: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' },
      take: 5
    });
    const recentActivity = recentPayments.map(p => ({
      type: 'payment',
      customerName: p.loan.customer?.name,
      loanId: p.loanId,
      amount: p.amount,
      date: p.paidAt
    }));

    res.json({
      dueToday,
      dueTodayCount: dueToday.length,
      dueTodayAmount,
      overdueCount: overdue.length,
      overdueAmount,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
