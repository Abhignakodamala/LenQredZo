import prisma from '../../lib/prisma';
import { Response } from 'express';


const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '';

export const analyzePortfolio = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    // Aggregate AI analysis is for owners/managers/accountants, not field agents.
    const allowed = ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to use AI analysis' });
    }

    const { prompt_type = 'portfolio_health', question = '' } = req.body;

    // ---- Gather ONLY anonymized aggregate numbers (no names/Aadhaar/PAN leave the server) ----
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET);

    const [loans, customers, payments, emis] = await Promise.all([
      prisma.loan.findMany({ where: { companyId } }),
      prisma.customer.findMany({ where: { companyId } }),
      prisma.payment.findMany({ where: { loan: { companyId } } }),
      prisma.eMI.findMany({ where: { loan: { companyId } }, include: { loan: true } })
    ]);

    const total_disbursed = loans.reduce((s, l) => s + l.amount, 0);
    const total_collected = payments.reduce((s, p) => s + p.amount, 0);
    const active_loans = loans.filter(l => l.status === 'active').length;
    const total_customers = customers.length;

    let overdue_emis = 0;
    let overdue_amount = 0;
    const customerOverdue: Record<number, number> = {};
    emis.forEach(e => {
      if (e.status !== 'paid' && new Date(e.dueDate) < istNow) {
        overdue_emis += 1;
        overdue_amount += (e.amount - (e.paidAmount || 0));
        const cid = e.loan.customerId;
        if (cid) customerOverdue[cid] = (customerOverdue[cid] || 0) + 1;
      }
    });
    const high_risk_customers = Object.values(customerOverdue).filter(v => v >= 2).length;

    const dueEmis = emis.filter(e => new Date(e.dueDate) <= istNow);
    const collection_efficiency = dueEmis.length > 0
      ? Number(((dueEmis.filter(e => e.status === 'paid').length / dueEmis.length) * 100).toFixed(1))
      : 0;
    const npa_percentage = total_disbursed > 0
      ? Number(((overdue_amount / total_disbursed) * 100).toFixed(2))
      : 0;

    const stats = {
      total_disbursed, total_collected, active_loans, total_customers,
      overdue_emis, overdue_amount, npa_percentage, collection_efficiency, high_risk_customers
    };

    // ---- Forward to the secured Python AI service with the shared internal key ----
    const aiRes = await (globalThis as any).fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': AI_SERVICE_KEY },
      body: JSON.stringify({ prompt_type, stats, question })
    });
    const data = await aiRes.json();
    if (!aiRes.ok) {
      return res.status(aiRes.status).json({ message: data.detail || 'AI service error' });
    }
    res.json({ ...data, stats });
  } catch (error: any) {
    res.status(502).json({ message: 'Could not reach the AI service. Make sure it is running on port 8000.' });
  }
};
