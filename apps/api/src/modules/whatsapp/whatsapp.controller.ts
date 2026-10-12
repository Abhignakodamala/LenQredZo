import { Response } from 'express';
import prisma from '../../lib/prisma';
import { decrypt, encrypt } from '../../utils/encryption';
import { customerScope } from '../../utils/scoping';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '';
const ADMIN_ROLES = ['owner', 'admin', 'Super Admin'];

function canManage(req: any): boolean {
  return ADMIN_ROLES.includes(req.user.role);
}

export const getWhatsAppCustomers = async (req: any, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: customerScope(req.user),
      select: {
        id: true,
        name: true,
        phone: true,
        aadhar: true,
        pan: true,
        loans: {
          select: {
            id: true,
            status: true,
            amount: true,
            type: true,
            emis: {
              select: {
                id: true,
                amount: true,
                dueDate: true,
                status: true,
                paidAmount: true
              },
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      }
    });
    res.json(customers.map(({ aadhar, pan, ...customer }) => ({
      ...customer,
      hasAadhar: Boolean(aadhar),
      hasPan: Boolean(pan)
    })));
  } catch { res.status(500).json({ message: 'Could not load WhatsApp customers' }); }
};

async function getCredentials(companyId: number) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { whatsAppSettings: true }
    });

    const token = company?.whatsappToken || company?.whatsAppSettings?.accessToken;
    const phoneId = company?.whatsappPhoneNumberId || company?.whatsAppSettings?.phoneNumberId;

    if (!token || !phoneId) return null;

    return {
      whatsapp_token: decrypt(token),
      phone_number_id: phoneId,
      company_name: company?.name || 'Finance Company'
    };
  } catch (err) {
    console.error('Error fetching WhatsApp credentials:', err);
    return null;
  }
}

async function callAiService(body: Record<string, any>) {
  // 1. Try AI microservice if running
  try {
    const response = await (globalThis as any).fetch(`${AI_SERVICE_URL}/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': AI_SERVICE_KEY },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('AI microservice offline, calling Meta WhatsApp Cloud API directly...');
  }

  // 2. Direct Meta Cloud API fallback
  const cleanPhone = String(body.customer_phone).replace(/\D/g, '');
  const to = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const url = `https://graph.facebook.com/v20.0/${body.phone_number_id}/messages`;

  let messageText = String(body.custom_message || '');
  if (!messageText) {
    const name = body.customer_name;
    const company = body.company_name || 'Finance Company';
    const loan = body.loan_id ? ` (Loan ID: ${body.loan_id})` : '';
    const amount = body.overdue_amount || body.emi_amount || '0';
    const linkSection = body.payment_link ? `\n\nYou can also pay online here:\n${body.payment_link}` : '';

    if (body.message_type === 'pending_emi') {
      messageText = `Hello ${name},\n\nThis is a reminder from ${company} regarding your loan${loan}.\n\nYour EMI of Rs. ${body.emi_amount || amount} is due on ${body.due_date || 'the due date'}.${linkSection}\n\nKindly make the payment on or before the due date. If you need any payment details or have any questions, please feel free to reply to this message.\n\nThank you,\n${company}`;
    } else if (body.message_type === 'receipt') {
      messageText = `Hello ${name},\n\nWe have received your payment of Rs. ${body.paid_amount || amount} towards your loan${loan}. Thank you for paying on time!\n\nYour account has been updated successfully.\n\nRegards,\n${company}`;
    } else if (body.message_type === 'late_fee') {
      messageText = `Hello ${name},\n\nWe noticed that your loan EMI of Rs. ${amount} for loan${loan} was due on ${body.due_date || 'the due date'} and is currently pending.${linkSection}\n\nPlease arrange to clear this payment as soon as possible to avoid late payment charges. If you need any assistance, please reply to this message.\n\nThank you,\n${company}`;
    } else if (body.message_type === 'credit_confirmation') {
      messageText = `Hello ${name},\n\nWe are glad to inform you that your loan application of Rs. ${body.loan_amount || amount}${loan} has been approved by ${company}.\n\nOur team will be in touch with you shortly regarding the next steps.\n\nBest regards,\n${company}`;
    } else if (body.message_type === 'welcome') {
      messageText = `Hello ${name},\n\nWelcome to ${company}! We are pleased to assist you with your loan requirements.\n\nIf you have any questions or need any help with your account, please feel free to reach out to us here.\n\nBest regards,\n${company}`;
    } else {
      messageText = `Hello ${name},\n\nThis is regarding your loan account${loan} with ${company}. Please contact our office if you have any questions.\n\nThank you,\n${company}`;
    }
  }

  const isTemplate = body.message_type === 'hello_world' || body.use_template;
  let payload: any = isTemplate
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' }
        }
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: messageText },
      };

  let response = await (globalThis as any).fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${body.whatsapp_token}`,
    },
    body: JSON.stringify(payload),
  });

  let data = await response.json();

  // If Meta rejected plain text due to 24-hr window / template restriction, retry with official hello_world template
  if (!response.ok && (data.error?.code === 131047 || data.error?.message?.includes('template'))) {
    console.warn('Plain text restricted by Meta. Retrying with official hello_world template...');
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }
      }
    };
    response = await (globalThis as any).fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.whatsapp_token}`,
      },
      body: JSON.stringify(payload),
    });
    data = await response.json();
  }

  if (!response.ok) {
    console.error('Meta WhatsApp API Error Details:', JSON.stringify(data, null, 2));
    const metaMsg = data.error?.message || data.detail || 'WhatsApp API request failed';
    if (data.error?.code === 190 || metaMsg.includes('Authentication Error') || metaMsg.includes('access token')) {
      throw new Error('Meta Access Token has expired (24h limit). Please click "Generate new token" in developers.facebook.com and update it in LenQredzo WhatsApp Settings.');
    }
    if (metaMsg.includes('not in allowed list') || data.error?.code === 131030) {
      throw new Error(`Recipient number (+${to}) is not in your Meta Test Recipient list. Please add it under 'Select recipient number' in developers.facebook.com to permit testing.`);
    }
    throw new Error(metaMsg);
  }
  return { success: true, to, data, sentText: messageText };
}

export const getWhatsAppSettings = async (req: any, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.json({ configured: false, phone_number_id: '' });
    }
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { whatsAppSettings: true }
    });

    const isConfigured = Boolean(
      (company?.whatsappToken && company?.whatsappPhoneNumberId) ||
      (company?.whatsAppSettings?.accessToken && company?.whatsAppSettings?.phoneNumberId)
    );

    const phoneId = company?.whatsappPhoneNumberId || company?.whatsAppSettings?.phoneNumberId || '';

    res.json({
      configured: isConfigured,
      phone_number_id: phoneId,
      company_name: company?.name || ''
    });
  } catch (err: any) {
    console.error('Could not load WhatsApp settings:', err);
    res.status(500).json({ message: 'Could not load WhatsApp settings' });
  }
};

export const saveWhatsAppSettings = async (req: any, res: Response) => {
  if (!canManage(req)) return res.status(403).json({ message: 'Only company administrators can change WhatsApp settings' });
  const { whatsapp_token, phone_number_id } = req.body;
  if (!whatsapp_token || !phone_number_id) return res.status(400).json({ message: 'WhatsApp token and phone number ID are required' });

  const companyId = req.user?.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'User is not assigned to a company' });
  }

  try {
    const encryptedToken = encrypt(whatsapp_token);

    // Save to Company table
    try {
      await prisma.company.update({
        where: { id: companyId },
        data: { whatsappToken: encryptedToken, whatsappPhoneNumberId: phone_number_id }
      });
    } catch (e) {
      console.warn('Could not update company table directly, attempting whatsAppSettings:', e);
    }

    // Save to WhatsAppSettings table
    try {
      await (prisma as any).whatsAppSettings?.upsert({
        where: { companyId },
        update: { accessToken: encryptedToken, phoneNumberId: phone_number_id, isEnabled: true },
        create: { companyId, accessToken: encryptedToken, phoneNumberId: phone_number_id, businessName: 'LenQredzo', isEnabled: true }
      });
    } catch (e) {
      console.warn('Could not update whatsAppSettings table:', e);
    }

    console.log('Successfully saved WhatsApp settings for company:', companyId, 'phone_number_id:', phone_number_id);
    res.json({ message: 'WhatsApp settings saved', configured: true, phone_number_id });
  } catch (error: any) {
    console.error('Could not save WhatsApp settings:', error);
    res.status(500).json({ message: error.message || 'Could not save WhatsApp settings' });
  }
};

export const getMessageTypes = async (_req: any, res: Response) => {
  res.json({ message_types: [
    'pending_emi', 'receipt', 'late_fee', 'guarantor_alert', 'credit_confirmation', 'welcome',
    'greetings', 'birthday', 'new_branch', 'alert', 'before_auction', 'after_auction',
    'cheque_deposit', 'cheque_return', 'receipt_cancel', 'member_enrolment', 'membership_renewal', 'penalty'
  ] });
};

export const getCustomerMessages = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: req.user.companyId }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const messages = await prisma.whatsAppMessage.findMany({
      where: { customerId, companyId: req.user.companyId },
      orderBy: { sentAt: 'asc' },
      take: 50
    });
    res.json(messages);
  } catch { res.status(500).json({ message: 'Could not load WhatsApp messages' }); }
};

export const sendManualMessage = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const credentials = await getCredentials(companyId);
    if (!credentials) return res.status(400).json({ message: 'WhatsApp is not configured for this company' });
    if (!req.body.customer_phone || !req.body.customer_name || !req.body.message_type) {
      return res.status(400).json({ message: 'customer_phone, customer_name, and message_type are required' });
    }

    const customerId = Number(req.body.customer_id);

    // Auto-fetch borrower loan and EMI details if missing
    if (customerId) {
      const activeLoan = await prisma.loan.findFirst({
        where: { customerId, companyId },
        include: {
          emis: {
            where: { status: { not: 'paid' } },
            orderBy: { dueDate: 'asc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (activeLoan) {
        req.body.loan_id = req.body.loan_id || `LN${1000 + activeLoan.id}`;
        req.body.loan_amount = req.body.loan_amount || String(activeLoan.amount);
        const nextEmi = activeLoan.emis?.[0];
        if (nextEmi) {
          const remainingAmount = nextEmi.amount - (nextEmi.paidAmount || 0);
          req.body.emi_amount = req.body.emi_amount || String(remainingAmount);
          req.body.due_date = req.body.due_date || new Date(nextEmi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      }
    }

    const company = await prisma.company.findUnique({ where: { id: req.user.companyId }, select: { name: true } });
    const result = await callAiService({ ...req.body, ...credentials, company_name: req.body.company_name || company?.name });

    const customer = await prisma.customer.findFirst({
      where: Number.isInteger(customerId) && customerId > 0
        ? { id: customerId, companyId }
        : { companyId, phone: req.body.customer_phone }
    });

    if (customer) {
      await prisma.whatsAppMessage.create({
        data: {
          companyId,
          customerId: customer.id,
          direction: 'sent',
          message: req.body.custom_message || result?.sentText || `[${req.body.message_type}] EMI: ₹${req.body.emi_amount || ''} Loan: ${req.body.loan_id || ''}`,
          messageType: req.body.message_type,
          status: 'sent'
        }
      });
    }
    res.json(result);
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    res.status(502).json({ message: error.message || 'Could not send WhatsApp message' });
  }
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
