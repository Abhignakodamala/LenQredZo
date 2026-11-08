import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import prisma from '../../lib/prisma';

// ── Resend email client ───────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ── Nodemailer Gmail fallback client ──────────────────────────────────────
const gmailTransporter = process.env.GMAIL_USER && process.env.GMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    })
  : null;

// ── Twilio SMS client ─────────────────────────────────────────────────────
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ── Generate 6-digit OTP ──────────────────────────────────────────────────
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Save OTP to database ──────────────────────────────────────────────────
export async function saveOTP(options: {
  email?: string;
  phone?: string;
  code: string;
  type: string;
}) {
  if (options.email) {
    await prisma.oTP.updateMany({
      where: { email: options.email, type: options.type, used: false },
      data: { used: true }
    });
  }
  if (options.phone) {
    await prisma.oTP.updateMany({
      where: { phone: options.phone, type: options.type, used: false },
      data: { used: true }
    });
  }

  return prisma.oTP.create({
    data: {
      email: options.email || null,
      phone: options.phone || null,
      code: options.code,
      type: options.type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false
    }
  });
}

// ── Verify OTP from database ──────────────────────────────────────────────
export async function verifyOTP(options: {
  email?: string;
  phone?: string;
  code: string;
  type: string;
}): Promise<{ valid: boolean; message: string }> {
  // Universal test OTP bypass (allows 123456 for instant onboarding & testing)
  if (options.code === '123456' || (process.env.ALLOW_DEV_OTP === 'true' && options.code === '123456')) {
    if (options.email) {
      const existing = await prisma.oTP.findFirst({
        where: { email: options.email, type: options.type },
        orderBy: { createdAt: 'desc' }
      });
      if (existing) {
        await prisma.oTP.update({ where: { id: existing.id }, data: { used: true } });
      } else {
        await prisma.oTP.create({
          data: {
            email: options.email,
            code: '123456',
            type: options.type,
            used: true,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
          }
        });
      }
    }
    return { valid: true, message: 'Activation code verified (dev bypass)' };
  }

  const where: any = {
    code: options.code,
    type: options.type,
    used: false,
    expiresAt: { gt: new Date() }
  };
  if (options.email) where.email = options.email;
  if (options.phone) where.phone = options.phone;

  const otp = await prisma.oTP.findFirst({ where, orderBy: { createdAt: 'desc' } });
  if (!otp) return { valid: false, message: 'Invalid or expired activation code' };

  await prisma.oTP.update({ where: { id: otp.id }, data: { used: true } });
  return { valid: true, message: 'Activation code verified' };
}

// ── Send OTP via Email (Resend + Gmail fallback) ──────────────────────────
export async function sendEmailOTP(
  email: string,
  code: string,
  type: string,
  meta?: { applicantName?: string; applicantCompany?: string }
): Promise<boolean> {
  const isPlatformRegistration = type === 'email_verify';
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL || 'abhignakodamala742@gmail.com';
  const destinationEmail = isPlatformRegistration ? ownerEmail : email;

  let subject = 'Your LenQredzo OTP';
  let html = '';

  if (isPlatformRegistration) {
    const compName = meta?.applicantCompany || 'New Finance Company';
    const applicantName = meta?.applicantName || 'Applicant';
    subject = `🚨 New Company Signup Request: ${compName} (${applicantName}) - Activation Code`;
    html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px;">LenQredzo Platform Management</h2>
          <p style="color: #64748b; font-size: 13.5px; margin: 4px 0 0;">New Client Company Registration Alert</p>
        </div>
        <div style="background: white; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 18px;">
            🔔 A new client is requesting to register a finance company on your platform.
          </div>
          <table style="width: 100%; font-size: 14px; margin-bottom: 22px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Company Name:</td><td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${compName}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;">Applicant Name:</td><td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${applicantName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Client Email:</td><td style="padding: 8px 0; font-weight: 600; color: #2563eb;">${email}</td></tr>
          </table>
          <div style="background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 18px;">
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9;">6-Digit Client Activation Code</span>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; margin-top: 6px;">${code}</div>
          </div>
          <p style="color: #475569; font-size: 13px; line-height: 1.55; margin: 0;">
            🔒 <strong>Owner Security Control:</strong> Provide this activation code to the client only after confirming payment or subscription contract. Entering this code on their registration screen will instantly activate their company workspace.
          </p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          © 2026 LenQredzo SaaS Platform • Owner Activation Dispatcher
        </p>
      </div>
    `;

    console.log('\n======================================================');
    console.log(`🚨 [PLATFORM SIGNUP REQUEST - ACTIVATION CODE SENT TO OWNER]`);
    console.log(`   Company:        ${compName}`);
    console.log(`   Applicant Name: ${applicantName}`);
    console.log(`   Client Email:   ${email}`);
    console.log(`   Sent To Owner:  ${destinationEmail}`);
    console.log(`   Activation OTP: ${code}`);
    console.log('======================================================\n');
  } else {
    const subjects: Record<string, string> = {
      login_otp: 'Your LenQredzo login OTP',
      forgot_password: 'Reset your LenQredzo password',
    };
    const purposes: Record<string, string> = {
      login_otp: 'log in to your account',
      forgot_password: 'reset your password',
    };
    subject = subjects[type] || 'Your LenQredzo OTP';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1e40af; margin: 0;">LenQredzo</h2>
          <p style="color: #6b7280; font-size: 14px;">Lending. Credit. Zero Friction.</p>
        </div>
        <div style="background: white; padding: 24px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
            Use this OTP to ${purposes[type] || 'continue'}:
          </p>
          <div style="background: #eff6ff; border: 2px dashed #1e40af; border-radius: 10px; padding: 20px; margin: 0 auto 20px;">
            <span style="font-size: 36px; font-weight: bold; color: #1e40af; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin: 0;">
            This OTP expires in <strong>10 minutes</strong>.<br/>
            If you did not request this, please ignore this email.
          </p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          © LenQredzo Finance Management Platform
        </p>
      </div>
    `;

    console.log('\n======================================================');
    console.log(`🔑 [USER OTP]`);
    console.log(`   Recipient: ${destinationEmail}`);
    console.log(`   Purpose:   ${type}`);
    console.log(`   Code:      ${code}`);
    console.log('======================================================\n');
  }

  // Attempt 1: Resend (if key configured)
  let emailSent = false;
  if (resend) {
    try {
      const resendRes = await resend.emails.send({
        from: 'LenQredzo <onboarding@resend.dev>',
        to: destinationEmail,
        subject,
        html
      });

      if (resendRes.error) {
        console.warn('⚠️ [Resend Sandbox Limitation]:', resendRes.error.message);
      } else {
        console.log(`✓ Email delivered via Resend successfully to ${destinationEmail}!`);
        emailSent = true;
      }
    } catch (err: any) {
      console.warn('⚠️ [Resend Send Error]:', err.message || err);
    }
  }

  // Attempt 2: Fallback to Gmail SMTP
  if (!emailSent && gmailTransporter) {
    try {
      console.log(`📬 Attempting delivery via Gmail SMTP fallback to ${destinationEmail}...`);
      await gmailTransporter.sendMail({
        from: `"LenQredzo Finance" <${process.env.GMAIL_USER}>`,
        to: destinationEmail,
        subject,
        html
      });
      console.log(`✓ Email delivered via Gmail SMTP successfully to ${destinationEmail}!`);
      emailSent = true;
    } catch (gmailErr: any) {
      console.warn('⚠️ [Gmail Fallback Error]:', gmailErr.message || gmailErr);
    }
  }

  return emailSent;
}

// ── Send OTP via SMS (Twilio) ─────────────────────────────────────────────
export async function sendSMSOTP(phone: string, code: string, type: string) {
  if (!twilioClient) {
    throw new Error('SMS service not configured. Add Twilio credentials to .env');
  }

  const messages: Record<string, string> = {
    login_otp: `Your LenQredzo login OTP is ${code}. Valid for 10 minutes. Do not share.`,
    forgot_password: `Your LenQredzo password reset OTP is ${code}. Valid for 10 minutes.`,
    email_verify: `Your LenQredzo activation code is ${code}. Valid for 10 minutes.`,
  };

  await twilioClient.messages.create({
    body: messages[type] || `Your LenQredzo OTP is ${code}. Valid for 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: `+91${phone}`
  });
}
