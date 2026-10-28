import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { decrypt } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '';

async function getCompanyRazorpay(companyId: number) {
  const razorpaySettings = await prisma.razorpaySettings.findUnique({
    where: { companyId },
  });

  const keyId = (razorpaySettings && razorpaySettings.isEnabled) ? razorpaySettings.keyId : process.env.RAZORPAY_KEY_ID;
  const keySecret = (razorpaySettings && razorpaySettings.isEnabled) ? razorpaySettings.keySecret : process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return {
    keyId,
    keySecret,
    instance: new Razorpay({ key_id: keyId, key_secret: keySecret }),
  };
}

async function getWhatsAppCredentials(companyId: number) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.whatsappToken || !company.whatsappPhoneNumberId) return null;
  return {
    whatsapp_token: decrypt(company.whatsappToken),
    phone_number_id: company.whatsappPhoneNumberId,
    company_name: company.name
  };
}

async function sendWhatsApp(body: Record<string, any>) {
  // 1. First try the AI microservice if running
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

  // 2. Fallback: Call Meta Cloud API directly from Node.js
  try {
    const cleanPhone = String(body.customer_phone).replace(/\D/g, '');
    const to = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const url = `https://graph.facebook.com/v20.0/${body.phone_number_id}/messages`;
    const messageText = body.custom_message || (body.payment_link
      ? `Dear ${body.customer_name},\n\nYour EMI of ₹${body.emi_amount} for Loan ${body.loan_id} is due on ${body.due_date}.\n\n👉 Pay Online via UPI / Card:\n${body.payment_link}\n\nPlease pay on time to avoid late fees.\n\n— ${body.company_name || 'LenQredzo Finance'}`
      : `Dear ${body.customer_name}, reminder for Loan ${body.loan_id}.`);

    const response = await (globalThis as any).fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.whatsapp_token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: messageText },
      }),
    });
    const resData = await response.json();
    return { success: response.ok, data: resData };
  } catch (directErr) {
    console.error('Direct Meta WhatsApp error:', directErr);
    return null;
  }
}

/**
 * 1. Send Payment Link to Borrower (WhatsApp + SMS)
 */
export const sendEmiPaymentLink = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { emiId, loanId } = req.body;
    if (!emiId || !loanId) {
      return res.status(400).json({ error: 'emiId and loanId are required' });
    }

    const emi = await prisma.eMI.findUnique({
      where: { id: Number(emiId) },
      include: {
        loan: {
          include: { customer: true, company: true }
        }
      }
    });

    if (!emi || emi.loanId !== Number(loanId)) {
      return res.status(404).json({ error: 'EMI not found' });
    }

    const customer = emi.loan.customer;
    if (!customer || !customer.phone) {
      return res.status(400).json({ error: 'Customer phone number is missing' });
    }

    const remainingAmount = emi.amount - (emi.paidAmount || 0);
    if (remainingAmount <= 0) {
      return res.status(400).json({ error: 'This EMI has already been paid in full' });
    }

    const rzp = await getCompanyRazorpay(user.companyId);
    if (!rzp) {
      return res.status(400).json({
        error: 'Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      });
    }

    // Format phone to standard Indian 10-digit / E.164
    let cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Create Razorpay Payment Link
    const paymentLink: any = await rzp.instance.paymentLink.create({
      amount: Math.round(remainingAmount * 100), // paise
      currency: 'INR',
      accept_partial: false,
      description: `EMI Payment for Loan LN${1000 + emi.loan.id} - ${emi.loan.type}`,
      customer: {
        name: customer.name,
        contact: cleanPhone,
        email: customer.email || undefined,
      },
      notify: {
        sms: true,
        email: false,
      },
      reminder_enable: true,
      notes: {
        emiId: String(emi.id),
        loanId: String(emi.loan.id),
        companyId: String(user.companyId),
        customerId: String(customer.id),
      },
      callback_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/loans/${emi.loan.id}?paid=true`,
      callback_method: 'get'
    });

    // Create or update pending Payment record
    await prisma.payment.create({
      data: {
        loanId: emi.loan.id,
        amount: remainingAmount,
        method: 'razorpay_link',
        status: 'pending',
        razorpayOrderId: paymentLink.id,
        reference: paymentLink.short_url,
      }
    });

    // Send WhatsApp notification with the payment link
    const waCreds = await getWhatsAppCredentials(user.companyId);
    let whatsappSent = false;
    if (waCreds) {
      const waResult = await sendWhatsApp({
        ...waCreds,
        message_type: 'pending_emi',
        customer_phone: customer.phone,
        customer_name: customer.name,
        loan_id: `LN${1000 + emi.loan.id}`,
        emi_amount: String(remainingAmount),
        due_date: new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        payment_link: paymentLink.short_url,
      });

      if (waResult?.success) {
        whatsappSent = true;
        await prisma.whatsAppMessage.create({
          data: {
            companyId: user.companyId,
            customerId: customer.id,
            direction: 'sent',
            message: `EMI Payment Link: ${paymentLink.short_url}`,
            messageType: 'pending_emi',
            status: 'sent'
          }
        });
      }
    }

    await logAudit({
      req,
      action: 'SENT_PAYMENT_LINK',
      entityType: 'EMI',
      entityId: emi.id,
      details: `Generated Razorpay link ₹${remainingAmount} for ${customer.name}. WhatsApp: ${whatsappSent ? 'Sent' : 'Skipped/Not configured'}`
    });

    const companyName = waCreds?.company_name || 'Finance Department';
    const dueDateFormatted = new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedMessage = `Dear ${customer.name},\n\nYour EMI of ₹${remainingAmount} for Loan LN${1000 + emi.loan.id} is due on ${dueDateFormatted}.\n\n👉 Pay Online via UPI / Card:\n${paymentLink.short_url}\n\nPlease pay on time to avoid late fees.\n\n— ${companyName}`;

    res.json({
      success: true,
      paymentLink: paymentLink.short_url,
      whatsappSent,
      phone: cleanPhone,
      formattedMessage,
      customerName: customer.name,
      message: whatsappSent
        ? 'Payment link generated and sent via WhatsApp API!'
        : 'Payment link generated successfully!'
    });
  } catch (error: any) {
    console.error('Send Payment Link Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate payment link' });
  }
};

/**
 * 2. Razorpay Server-to-Server Webhook Verification
 * This endpoint receives payment notifications when the borrower pays via UPI/Link.
 */
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({ error: 'Signature or secret missing' });
    }

    // Verify webhook signature
    const bodyStr = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyStr)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Razorpay webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    console.log(`Received verified Razorpay webhook: ${event}`);

    // We handle payment_link.paid, payment.captured, or order.paid
    let paymentEntity = req.body.payload?.payment?.entity;
    let paymentLinkEntity = req.body.payload?.payment_link?.entity;

    const notes = paymentLinkEntity?.notes || paymentEntity?.notes || {};
    const emiId = notes.emiId ? Number(notes.emiId) : null;
    const loanId = notes.loanId ? Number(notes.loanId) : null;
    const companyId = notes.companyId ? Number(notes.companyId) : null;

    if (!emiId || !loanId) {
      // Event acknowledged even if not an EMI link
      return res.json({ status: 'ignored_non_emi' });
    }

    const paidAmount = (paymentEntity?.amount || paymentLinkEntity?.amount || 0) / 100;
    const razorpayPaymentId = paymentEntity?.id || 'ONLINE_UPI';

    // 1. Mark EMI as paid
    const updatedEmi = await prisma.eMI.update({
      where: { id: emiId },
      data: {
        status: 'paid',
        paidAmount: Math.round(paidAmount),
      }
    });

    // 2. Mark Payment record as verified & success
    await prisma.payment.create({
      data: {
        loanId,
        amount: paidAmount,
        method: paymentEntity?.method || 'upi',
        status: 'success',
        verified: true,
        paidAt: new Date(),
        razorpayPaymentId,
        reference: paymentLinkEntity?.short_url || razorpayPaymentId,
      }
    });

    // 3. Log Audit
    if (companyId) {
      await prisma.auditLog.create({
        data: {
          companyId,
          action: 'ONLINE_EMI_VERIFIED',
          entityType: 'EMI',
          entityId: emiId,
          details: `Automated Razorpay verification: ₹${paidAmount} collected via ${paymentEntity?.method || 'UPI'}. Txn: ${razorpayPaymentId}`
        }
      });

      // 4. Send automated WhatsApp Receipt to borrower
      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { customer: true, company: true }
      });

      if (loan?.customer?.phone) {
        const waCreds = await getWhatsAppCredentials(companyId);
        if (waCreds) {
          await sendWhatsApp({
            ...waCreds,
            message_type: 'receipt',
            customer_phone: loan.customer.phone,
            customer_name: loan.customer.name,
            loan_id: `LN${1000 + loan.id}`,
            paid_amount: String(paidAmount),
            payment_method: (paymentEntity?.method || 'UPI').toUpperCase(),
          });
        }
      }
    }

    res.json({ status: 'success', emiId, paidAmount });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};

/**
 * 3. Direct Modal flow (optional fallback)
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { loanId, emiId, amount } = req.body;
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const rzp = await getCompanyRazorpay(user.companyId);
    if (!rzp) return res.status(400).json({ error: 'Razorpay is not configured' });

    const order = await rzp.instance.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `receipt_emi_${emiId}`,
    });

    const payment = await prisma.payment.create({
      data: {
        loanId,
        amount,
        method: 'razorpay',
        razorpayOrderId: order.id,
      },
    });

    res.json({ order, paymentId: payment.id, keyId: rzp.keyId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId, emiId } = req.body;
    const user = (req as any).user;
    if (!user || !user.companyId) return res.status(401).json({ error: 'Unauthorized' });

    const rzp = await getCompanyRazorpay(user.companyId);
    if (!rzp) return res.status(400).json({ error: 'Razorpay is not configured' });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', rzp.keySecret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: 'success',
          verified: true,
          paidAt: new Date(),
        },
      });

      if (emiId) {
        await prisma.eMI.update({
          where: { id: emiId },
          data: { status: 'paid' },
        });
      }

      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};



export const getPublicLoanPaymentDetails = async (req: Request, res: Response) => {
  try {
    const loanId = Number(req.params.loanId);
    if (!loanId || isNaN(loanId)) {
      return res.status(400).json({ success: false, error: 'Invalid loan reference number' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        customer: true,
        company: true,
        emis: { orderBy: { dueDate: 'asc' } }
      }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan account not found' });
    }

    const customer = loan.customer || ({} as any);
    const company = loan.company || ({} as any);
    const companyName = company.name || 'LenQredzo Capital Private Limited';
    const upiVpa = (company as any).upiVpa || 'lenqredzo.pay@axisbank';

    const nameParts = (customer.name || 'Borrower').trim().split(' ');
    const maskedName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];

    const maskedPhone = customer.phone && customer.phone.length >= 4
      ? `••••••${customer.phone.slice(-4)}`
      : '••••';

    const pendingEmis = loan.emis
      .filter((e: any) => e.status !== 'paid')
      .map((e: any) => {
        const remaining = e.amount - (e.paidAmount || 0);
        return {
          id: e.id,
          amount: e.amount,
          paidAmount: e.paidAmount || 0,
          remaining,
          dueDate: e.dueDate,
          dueDateFormatted: new Date(e.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
          }),
          penalty: e.penalty || 0,
          status: e.status
        };
      });

    const totalOutstanding = pendingEmis.reduce((sum: number, e: any) => sum + e.remaining, 0);

    let activeMandate = null;
    const mandateAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Mandate',
        entityId: loan.id
      },
      orderBy: { createdAt: 'desc' }
    });
    if (mandateAudit && mandateAudit.details) {
      try {
        const p = JSON.parse(mandateAudit.details);
        if (p.status === 'ACTIVE') {
          activeMandate = {
            umn: p.umn,
            bankName: p.bankName,
            maskedAccount: p.maskedAccount,
            mandateType: p.mandateType
          };
        }
      } catch {}
    }

    const rzp = await getCompanyRazorpay(loan.companyId || 0);

    res.json({
      success: true,
      loan: {
        id: loan.id,
        loanRef: `LN${1000 + loan.id}`,
        type: loan.type,
        amount: loan.amount,
        tenure: loan.tenure,
        frequency: loan.frequency,
        status: loan.status,
        totalOutstanding
      },
      borrower: {
        name: maskedName,
        phone: maskedPhone
      },
      company: {
        name: companyName,
        upiVpa,
        supportPhone: (company as any).phone || '+91 98765 43210',
        logo: company.logo || null
      },
      pendingEmis,
      activeMandate,
      razorpayKeyId: rzp ? rzp.keyId : null
    });
  } catch (error: any) {
    console.error('Get public loan payment details error:', error);
    res.status(500).json({ success: false, error: 'Unable to retrieve loan details' });
  }
};

export const submitPublicUpiPayment = async (req: Request, res: Response) => {
  try {
    const { loanId, emiId, amount, utr, payerName, payerPhone } = req.body;

    if (!loanId || !emiId || !amount || !utr) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Loan ID, EMI ID, Amount, and the 12-digit UPI UTR reference number.'
      });
    }

    const cleanUtr = String(utr).trim();
    if (cleanUtr.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Bank UTR / UPI Reference Number (at least 6 alphanumeric characters).'
      });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: Number(loanId) },
      include: { customer: true, company: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan account not found' });
    }

    const emi = await prisma.eMI.findUnique({
      where: { id: Number(emiId) }
    });

    if (!emi || emi.loanId !== loan.id) {
      return res.status(404).json({ success: false, error: 'EMI installment record not found' });
    }

    if (emi.status === 'paid') {
      return res.status(400).json({ success: false, error: 'This EMI installment has already been settled in full.' });
    }

    const payAmount = Math.round(Number(amount));
    if (payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
    }

    const remaining = emi.amount - (emi.paidAmount || 0);
    if (payAmount > remaining) {
      return res.status(400).json({
        success: false,
        error: `Amount exceeds the remaining EMI balance of ₹${remaining.toLocaleString('en-IN')}`
      });
    }

    const newPaid = (emi.paidAmount || 0) + payAmount;
    const fullyCleared = newPaid >= emi.amount;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const receiptNumber = `RCT-UPI-${dateStr}-${randSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      await tx.eMI.update({
        where: { id: emi.id },
        data: {
          paidAmount: newPaid,
          status: fullyCleared ? 'paid' : 'partial'
        }
      });

      const payment = await tx.payment.create({
        data: {
          loanId: loan.id,
          amount: payAmount,
          method: 'upi_borrower_portal',
          reference: cleanUtr,
          verified: true,
          status: 'completed',
          paidAt: now
        }
      });

      const remainingPending = await tx.eMI.count({
        where: { loanId: loan.id, status: { not: 'paid' } }
      });

      let loanCompleted = false;
      if (remainingPending === 0) {
        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'completed' }
        });
        loanCompleted = true;
      }

      return { payment, loanCompleted };
    });

    await prisma.auditLog.create({
      data: {
        companyId: loan.companyId || 0,
        action: 'BORROWER_UPI_PAYMENT',
        entityType: 'Payment',
        entityId: result.payment.id,
        details: JSON.stringify({
          receiptNumber,
          loanId: loan.id,
          loanRef: `LN${1000 + loan.id}`,
          emiId: emi.id,
          amount: payAmount,
          utr: cleanUtr,
          payerName: payerName || loan.customer?.name,
          payerPhone: payerPhone || loan.customer?.phone,
          paidAt: now.toISOString(),
          loanCompleted: result.loanCompleted
        })
      }
    });

    res.json({
      success: true,
      message: `Payment of ₹${payAmount.toLocaleString('en-IN')} confirmed successfully!`,
      receipt: {
        receiptNumber,
        loanRef: `LN${1000 + loan.id}`,
        borrowerName: loan.customer?.name,
        amount: payAmount,
        utr: cleanUtr,
        paidAt: now.toISOString(),
        companyName: loan.company?.name || 'LenQredzo Capital',
        loanCompleted: result.loanCompleted,
        status: fullyCleared ? 'CLEARED' : 'PARTIAL'
      }
    });
  } catch (error: any) {
    console.error('Submit public UPI payment error:', error);
    res.status(500).json({ success: false, error: error.message || 'Payment processing failed' });
  }
};
