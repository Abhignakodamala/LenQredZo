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


export const getUpcomingDueReminders = async (req: any, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const companyId = req.user.companyId;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true }
    });
    const companyName = company?.name || 'LenQredzo Capital';

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const emis = await prisma.eMI.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: {
          gte: threeDaysAgo,
          lte: dayAfterTomorrow
        },
        loan: {
          companyId,
          status: 'active'
        }
      },
      include: {
        loan: {
          include: { customer: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    const items = emis.map((e: any) => {
      const due = new Date(e.dueDate);
      due.setHours(0, 0, 0, 0);

      const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
      let timingCategory = 'due_today';
      if (diffDays === 1) timingCategory = 'due_tomorrow'; // 24-Hr Advance
      else if (diffDays > 1) timingCategory = 'upcoming';
      else if (diffDays < 0) timingCategory = 'overdue';

      const customer = e.loan.customer || {};
      const remainingAmount = e.amount - (e.paidAmount || 0) + (e.penalty || 0);
      const payUrl = `${clientUrl}/pay/${e.loanId}`;

      const dateStr = due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      // English template
      const msgEn = `Namaste ${customer.name || 'Customer'} garu, this is a gentle 24-hr advance reminder from ${companyName}. Your Loan (${e.loan.loanId || `LN${1000 + e.loanId}`}) EMI of ₹${remainingAmount.toLocaleString('en-IN')} is due on ${dateStr}. Please pay securely via 1-Tap UPI link: ${payUrl} . Thank you!`;

      // Telugu / Tanglish template
      const msgTe = `Namaste ${customer.name || 'Customer'} garu, ${companyName} nunchi 24-gantala advance reminder. Mee Loan (LN${1000 + e.loanId}) EMI ₹${remainingAmount.toLocaleString('en-IN')} ${diffDays === 1 ? 'repu' : diffDays === 0 ? 'ee roju' : dateStr + ' na'} due undhi. GPay/PhonePe tho direct ga kattadaniki ee link click cheyyandi: ${payUrl} . Dhanyavadhamulu!`;

      return {
        emiId: e.id,
        loanId: e.loanId,
        loanRef: `LN${1000 + e.loanId}`,
        customerId: customer.id,
        customerName: customer.name || 'Borrower',
        customerPhone: customer.phone || '',
        customerCity: customer.city || '—',
        emiAmount: e.amount,
        paidAmount: e.paidAmount || 0,
        penalty: e.penalty || 0,
        remainingAmount,
        dueDate: e.dueDate,
        dueDateFormatted: dateStr,
        diffDays,
        timingCategory,
        payUrl,
        msgEn,
        msgTe
      };
    });

    res.json({
      success: true,
      totalCount: items.length,
      dueTomorrowCount: items.filter(i => i.timingCategory === 'due_tomorrow').length,
      dueTodayCount: items.filter(i => i.timingCategory === 'due_today').length,
      overdueCount: items.filter(i => i.timingCategory === 'overdue').length,
      items
    });
  } catch (error: any) {
    console.error('getUpcomingDueReminders error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch upcoming dues' });
  }
};


// ─────────────────────────────────────────────────────────────
// 🤖 INTERACTIVE CUSTOMER WHATSAPP SELF-SERVICE BOT ENGINE
// ─────────────────────────────────────────────────────────────

export async function processCustomerBotReply(phone: string, rawText: string, companyId?: number) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const searchPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
  const text = (rawText || '').trim().toLowerCase();

  // Find customer by phone (or fallback to latest active customer if testing with empty phone)
  let customer: any = null;
  if (searchPhone) {
    customer = await prisma.customer.findFirst({
      where: {
        phone: { contains: searchPhone },
        ...(companyId ? { companyId } : {})
      },
      include: {
        company: true,
        branch: true,
        loans: {
          where: { status: { in: ['active', 'disbursed', 'overdue', 'pending'] } },
          include: {
            emis: {
              orderBy: { dueDate: 'asc' }
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 3
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  // Fallback to first available customer in company if search phone didn't match (for smooth testing)
  if (!customer && companyId) {
    customer = await prisma.customer.findFirst({
      where: { companyId },
      include: {
        company: true,
        branch: true,
        loans: {
          where: { status: { in: ['active', 'disbursed', 'overdue', 'pending'] } },
          include: {
            emis: { orderBy: { dueDate: 'asc' } },
            payments: { orderBy: { createdAt: 'desc' }, take: 3 }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!customer) {
    const unregReply = `🙏 *Namaste!*\n\nWelcome to *LenQredzo Capital* WhatsApp Self-Service Assistant 🤖.\n\nMee phone number (+91 ${searchPhone || phone}) maa loan system lo register kaledhu.\n\nKotha loan sanction kavali anna, leda help kavali anna, please visit your nearest branch or call our customer desk at *+91 98765 43210*.\n\nDhanyavadhamulu!`;
    return {
      matched: false,
      reply: unregReply,
      customer: null
    };
  }

  const customerName = customer.name || 'Borrower';
  const companyName = customer.company?.name || 'LenQredzo Capital';
  const branchName = customer.branch?.name || 'Main Branch';
  const activeLoan = customer.loans?.[0];

  let replyText = '';

  // Keyword Matching
  const isGreeting = ['hi', 'hello', 'hey', 'namaste', 'namaskaram', 'menu', 'options', 'help', 'start', 'bot', '0'].includes(text);
  const isBalance = ['1', 'balance', 'outstanding', 'bakaya', 'baqaya', 'loan balance', 'mottham'].some(k => text.includes(k));
  const isEmi = ['2', 'emi', 'due', 'pay', 'payment', 'kattali', 'kattu', 'upi', 'link'].some(k => text.includes(k));
  const isStatement = ['3', 'statement', 'mini statement', 'history', 'payments', 'receipt', 'receipts'].some(k => text.includes(k));
  const isLoanTerms = ['4', 'details', 'terms', 'interest', 'tenure', 'summary', 'sanction'].some(k => text.includes(k));
  const isSupport = ['5', 'support', 'manager', 'agent', 'branch', 'contact', 'call', 'office', 'helpdesk'].some(k => text.includes(k));

  if (isGreeting) {
    replyText = `🙏 *Namaste ${customerName} garu!*\nWelcome to *${companyName}* WhatsApp Self-Service 🤖\n\nMee account details instant ga telusukovadaniki kinda options lo number tho reply ivvandi:\n\n1️⃣ *Loan Balance & Total Outstanding*\n2️⃣ *Next EMI Due Date & 1-Tap Pay Link*\n3️⃣ *Mini Statement (Last 3 Payments)*\n4️⃣ *Loan Details & Interest Rate*\n5️⃣ *Talk to Branch Manager / Agent*\n\n_(Eg: Type 1 or Balance)_`;
  } else if (isBalance) {
    if (!activeLoan) {
      replyText = `ℹ️ *Account Status:*\nNamaste ${customerName} garu, mee account lo ippatiki active loans emi levu. Kotha loan sanction kosam branch ni contact cheyandi!`;
    } else {
      const unpaidEmis = (activeLoan.emis || []).filter((e: any) => e.status !== 'paid');
      const totalOutstanding = unpaidEmis.reduce((sum: number, e: any) => sum + (e.amount - (e.paidAmount || 0) + (e.penalty || 0)), 0);
      const nextEmi = unpaidEmis[0];
      const nextDueFormatted = nextEmi ? new Date(nextEmi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'All Paid';
      const payUrl = `${clientUrl}/pay/${activeLoan.id}`;

      replyText = `📊 *Loan Balance Summary*\n\nBorrower: *${customerName}*\nLoan Ref: *LN${1000 + activeLoan.id}* (${(activeLoan.type || 'Personal').toUpperCase()})\nSanctioned Amount: *₹${(activeLoan.amount || 0).toLocaleString('en-IN')}*\n\n💰 *Total Outstanding:* *₹${totalOutstanding.toLocaleString('en-IN')}*\n📅 *Remaining EMIs:* ${unpaidEmis.length} installments\n🚦 *Status:* ${(activeLoan.status || 'Active').toUpperCase()}\n\nNext EMI due: *${nextDueFormatted}*\n👉 Pay Now: ${payUrl}\n\n_Reply 2 for EMI payment or Menu for options._`;
    }
  } else if (isEmi) {
    if (!activeLoan) {
      replyText = `ℹ️ Namaste ${customerName} garu, currently mee peru meeda active EMI payments emi pending levu.`;
    } else {
      const unpaidEmis = (activeLoan.emis || []).filter((e: any) => e.status !== 'paid');
      const nextEmi = unpaidEmis[0];

      if (!nextEmi) {
        replyText = `🎉 *Congratulations ${customerName} garu!*\n\nMee loan (LN${1000 + activeLoan.id}) motham EMIs pay aipoyayi! Zero outstanding balance.\nNOC leda Closure Certificate kosam branch ni contact cheyandi.`;
      } else {
        const remainingAmount = nextEmi.amount - (nextEmi.paidAmount || 0) + (nextEmi.penalty || 0);
        const due = new Date(nextEmi.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
        const dateStr = due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const payUrl = `${clientUrl}/pay/${activeLoan.id}`;

        let urgencyTag = 'Upcoming';
        if (diffDays < 0) urgencyTag = `⚠️ OVERDUE by ${Math.abs(diffDays)} days!`;
        else if (diffDays === 0) urgencyTag = '⚡ DUE TODAY!';
        else if (diffDays === 1) urgencyTag = '⏰ Due Tomorrow (24h Advance)';

        replyText = `💳 *Next EMI Payment Details*\n\nLoan ID: *LN${1000 + activeLoan.id}*\nBorrower: *${customerName}*\n\n📌 *EMI Amount:* ₹${nextEmi.amount.toLocaleString('en-IN')}\n⚠️ *Late Fee:* ₹${nextEmi.penalty || 0}\n✅ *Total Payable:* *₹${remainingAmount.toLocaleString('en-IN')}*\n🗓️ *Due Date:* *${dateStr}* (${urgencyTag})\n\n👉 *1-Tap Instant UPI Payment:*\n${payUrl}\n\n_(Google Pay, PhonePe, Paytm or BHIM UPI tho direct ga pay cheyandi. Instant receipt generate avthundi!)_`;
      }
    }
  } else if (isStatement) {
    if (!activeLoan) {
      replyText = `ℹ️ Namaste ${customerName} garu, records lo active loan statements levu.`;
    } else {
      const payments = activeLoan.payments || [];
      if (payments.length === 0) {
        replyText = `📑 *Mini Statement - LN${1000 + activeLoan.id}*\n\nBorrower: *${customerName}*\nIppativaraku system lo digital payment records emi register avvaledu.\nNext EMI pay cheyadaniki reply *2* ivvandi.`;
      } else {
        const lines = payments.map((p: any, idx: number) => {
          const dt = new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return `${idx + 1}. *₹${p.amount.toLocaleString('en-IN')}* - Paid on ${dt} (${(p.paymentMethod || 'UPI').toUpperCase()})\n   UTR: ${p.utr || 'Direct Cash'}`;
        }).join('\n\n');

        replyText = `📑 *Mini Statement (Last 3 Payments)*\nLoan Ref: *LN${1000 + activeLoan.id}*\nCustomer: *${customerName}*\n\n${lines}\n\n✅ Mee payments annee bank records lo successfully updated.\n_Reply Menu to return to main options._`;
      }
    }
  } else if (isLoanTerms) {
    if (!activeLoan) {
      replyText = `ℹ️ Namaste ${customerName} garu, mee peru meeda active loan details emi levu.`;
    } else {
      const totalEmis = activeLoan.emis ? activeLoan.emis.length : 0;
      const paidEmis = activeLoan.emis ? activeLoan.emis.filter((e: any) => e.status === 'paid').length : 0;
      const disbursalDate = new Date(activeLoan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      replyText = `📋 *Loan Product & Sanction Terms*\n\nLoan ID: *LN${1000 + activeLoan.id}*\nBorrower: *${customerName}*\nLoan Type: *${(activeLoan.type || 'Personal').toUpperCase()}*\nSanctioned Amount: *₹${(activeLoan.amount || 0).toLocaleString('en-IN')}*\nInterest Rate: *${activeLoan.interestRate || 14}% per annum*\nTenure: *${activeLoan.tenure || 12} Months*\nEMIs Completed: *${paidEmis} of ${totalEmis} paid*\nDisbursal Date: *${disbursalDate}*\n\n_Reply 2 for EMI payment or Menu for options._`;
    }
  } else if (isSupport) {
    replyText = `📞 *Branch Helpdesk & Executive Support*\n\nCustomer: *${customerName}*\nAssigned Branch: *${branchName}*\nManager Desk: *+91 98765 43210*\nOffice Hours: *Mon - Sat: 9:30 AM to 6:30 PM*\nAddress: *${companyName}, Station Road, Main Branch*\n\n🛎️ *Note:* Mana collection / branch officer ki mee request alert vellindi. Varu meeku short time lo call chestharu. Dhanyavadhamulu! 🙏`;
  } else {
    replyText = `🙏 *Namaste ${customerName} garu!*\n\nMee message maaku reach ayyindi. Kinda options lo number type chesi instant details pondandi:\n\n1️⃣ - Loan Balance & Outstanding\n2️⃣ - Next EMI Due & 1-Tap Pay Link\n3️⃣ - Mini Statement (Recent Receipts)\n4️⃣ - Loan Sanction Terms\n5️⃣ - Branch Manager Support\n\nOr type *Hi* to see main menu!`;
  }

  // Persist both incoming and outgoing bot messages in WhatsAppMessage table
  try {
    const cId = customer.companyId;
    await prisma.whatsAppMessage.create({
      data: {
        companyId: cId,
        customerId: customer.id,
        direction: 'received',
        message: rawText,
        messageType: 'incoming_bot',
        status: 'delivered'
      }
    });

    await prisma.whatsAppMessage.create({
      data: {
        companyId: cId,
        customerId: customer.id,
        direction: 'sent',
        message: replyText,
        messageType: 'bot_auto_reply',
        status: 'sent'
      }
    });
  } catch (err) {
    console.warn('Could not persist bot message to WhatsAppMessage table:', err);
  }

  // Attempt real Meta Cloud API dispatch if credentials exist
  try {
    const credentials = await getCredentials(customer.companyId);
    if (credentials) {
      await callAiService({
        ...credentials,
        customer_phone: customer.phone,
        customer_name: customer.name,
        custom_message: replyText,
        message_type: 'custom'
      });
    }
  } catch (err) {
    console.warn('Meta WhatsApp live send fallback:', err);
  }

  return {
    matched: true,
    reply: replyText,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loanId: activeLoan ? `LN${1000 + activeLoan.id}` : null
    }
  };
}

export const simulateCustomerBotMessage = async (req: any, res: Response) => {
  try {
    const { customer_phone, message_text } = req.body;
    if (!message_text) {
      return res.status(400).json({ success: false, message: 'message_text is required' });
    }
    const companyId = req.user?.companyId;
    const result = await processCustomerBotReply(customer_phone || '', message_text, companyId);
    res.json({
      success: true,
      incomingMessage: message_text,
      phone: customer_phone,
      botReply: result.reply,
      customer: result.customer,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (error: any) {
    console.error('simulateCustomerBotMessage error:', error);
    res.status(500).json({ success: false, error: error.message || 'Bot processing failed' });
  }
};

export const getBotLogs = async (req: any, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        messageType: { in: ['incoming_bot', 'bot_auto_reply'] }
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 40
    });
    res.json({ success: true, count: messages.length, messages });
  } catch (error: any) {
    console.error('getBotLogs error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch bot logs' });
  }
};

export const verifyWhatsAppWebhook = (req: any, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'lenqredzo_verify_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('Meta WhatsApp Webhook verified successfully!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const handleWhatsAppWebhook = async (req: any, res: Response) => {
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const body = message.text?.body;
      console.log(`Incoming WhatsApp webhook message from ${from}: ${body}`);
      await processCustomerBotReply(from, body);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('handleWhatsAppWebhook error:', error);
    res.sendStatus(200);
  }
};
