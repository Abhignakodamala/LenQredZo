import { Response } from 'express';
import prisma from '../../lib/prisma';
import { decrypt, encrypt } from '../../utils/encryption';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '';
const ADMIN_ROLES = ['owner', 'admin', 'Super Admin'];

function canManage(req: any): boolean {
  return ADMIN_ROLES.includes(req.user.role);
}

async function getCredentials(companyId: number) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.whatsappToken || !company.whatsappPhoneNumberId) return null;
  return {
    whatsapp_token: decrypt(company.whatsappToken),
    phone_number_id: company.whatsappPhoneNumberId
  };
}

async function callAiService(body: Record<string, unknown>) {
  const response = await (globalThis as any).fetch(`${AI_SERVICE_URL}/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': AI_SERVICE_KEY },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'WhatsApp service error');
  return data;
}

export const getWhatsAppSettings = async (req: any, res: Response) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
    res.json({
      configured: Boolean(company?.whatsappToken && company.whatsappPhoneNumberId),
      phone_number_id: company?.whatsappPhoneNumberId || ''
    });
  } catch { res.status(500).json({ message: 'Could not load WhatsApp settings' }); }
};

export const saveWhatsAppSettings = async (req: any, res: Response) => {
  if (!canManage(req)) return res.status(403).json({ message: 'Only company administrators can change WhatsApp settings' });
  const { whatsapp_token, phone_number_id } = req.body;
  if (!whatsapp_token || !phone_number_id) return res.status(400).json({ message: 'WhatsApp token and phone number ID are required' });
  try {
    await prisma.company.update({
      where: { id: req.user.companyId },
      data: { whatsappToken: encrypt(whatsapp_token), whatsappPhoneNumberId: phone_number_id }
    });
    res.json({ message: 'WhatsApp settings saved', configured: true, phone_number_id });
  } catch { res.status(500).json({ message: 'Could not save WhatsApp settings' }); }
};

export const getMessageTypes = async (_req: any, res: Response) => {
  res.json({ message_types: [
    'pending_emi', 'receipt', 'late_fee', 'guarantor_alert', 'credit_confirmation', 'welcome',
    'greetings', 'birthday', 'new_branch', 'alert', 'before_auction', 'after_auction',
    'cheque_deposit', 'cheque_return', 'receipt_cancel', 'member_enrolment', 'membership_renewal', 'penalty'
  ] });
};

export const sendManualMessage = async (req: any, res: Response) => {
  try {
    const credentials = await getCredentials(req.user.companyId);
    if (!credentials) return res.status(400).json({ message: 'WhatsApp is not configured for this company' });
    if (!req.body.customer_phone || !req.body.customer_name || !req.body.message_type) {
      return res.status(400).json({ message: 'customer_phone, customer_name, and message_type are required' });
    }
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId }, select: { name: true } });
    const result = await callAiService({ ...req.body, ...credentials, company_name: req.body.company_name || company?.name });
    res.json(result);
  } catch (error: any) { res.status(502).json({ message: error.message || 'Could not send WhatsApp message' }); }
};

export const sendPendingEmiReminders = async (req: any, res: Response) => {
  try {
    const credentials = await getCredentials(req.user.companyId);
    if (!credentials) return res.status(400).json({ message: 'WhatsApp is not configured for this company' });
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId }, select: { name: true } });
    const emis = await prisma.eMI.findMany({
      where: { status: { not: 'paid' }, loan: { companyId: req.user.companyId } },
      include: { loan: { include: { customer: true } } }
    });
    const results = [];
    for (const emi of emis) {
      const result = await callAiService({
        ...credentials, message_type: 'pending_emi', customer_phone: emi.loan.customer.phone,
        customer_name: emi.loan.customer.name, company_name: company?.name,
        loan_id: String(emi.loanId), emi_amount: String(emi.amount), due_date: emi.dueDate.toISOString().slice(0, 10)
      });
      results.push(result);
    }
    res.json({ success: true, sent: results.length, results });
  } catch (error: any) { res.status(502).json({ message: error.message || 'Could not send pending EMI reminders' }); }
};
