import { Resend } from 'resend';
import twilio from 'twilio';
import prisma from '../../lib/prisma';

// ── Resend email client ───────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

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
  const where: any = {
    code: options.code,
    type: options.type,
    used: false,
    expiresAt: { gt: new Date() }
  };
  if (options.email) where.email = options.email;
  if (options.phone) where.phone = options.phone;

  const otp = await prisma.oTP.findFirst({ where, orderBy: { createdAt: 'desc' } });
  if (!otp) return { valid: false, message: 'Invalid or expired OTP' };

  await prisma.oTP.update({ where: { id: otp.id }, data: { used: true } });
  return { valid: true, message: 'OTP verified' };
}

// ── Send OTP via Email (Resend) ───────────────────────────────────────────
export async function sendEmailOTP(email: string, code: string, type: string) {
  const subjects: Record<string, string> = {
    email_verify: 'Verify your LenQredzo email',
    login_otp: 'Your LenQredzo login OTP',
    forgot_password: 'Reset your LenQredzo password',
  };

  const purposes: Record<string, string> = {
    email_verify: 'verify your email address',
    login_otp: 'log in to your account',
    forgot_password: 'reset your password',
  };

  await resend.emails.send({
    from: 'LenQredzo <onboarding@resend.dev>',
    to: email,
    subject: subjects[type] || 'Your LenQredzo OTP',
    html: `
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
    `
  });
}

// ── Send OTP via SMS (Twilio) ─────────────────────────────────────────────
export async function sendSMSOTP(phone: string, code: string, type: string) {
  if (!twilioClient) {
    throw new Error('SMS service not configured. Add Twilio credentials to .env');
  }

  const messages: Record<string, string> = {
    login_otp: `Your LenQredzo login OTP is ${code}. Valid for 10 minutes. Do not share.`,
    forgot_password: `Your LenQredzo password reset OTP is ${code}. Valid for 10 minutes.`,
    email_verify: `Your LenQredzo verification OTP is ${code}. Valid for 10 minutes.`,
  };

  await twilioClient.messages.create({
    body: messages[type] || `Your LenQredzo OTP is ${code}. Valid for 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: `+91${phone}`
  });
}