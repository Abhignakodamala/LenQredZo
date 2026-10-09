import prisma from '../../lib/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateOTP, saveOTP, verifyOTP, sendEmailOTP, sendSMSOTP } from './otp.service';
import { logAudit } from '../../utils/audit';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in the environment.');
}

// ── Helper: build JWT token ───────────────────────────────────────────────
function makeToken(user: any) {
  return jwt.sign(
    { userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(user: any) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
}

// ── 1. REGISTER ───────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, companyName, accessCode } = req.body;

    const REQUIRED_CODE = process.env.SIGNUP_ACCESS_CODE || '';
    if (!REQUIRED_CODE || accessCode !== REQUIRED_CODE) {
      return res.status(403).json({ message: 'Invalid or missing access code. Contact LenQredzo to get one.' });
    }
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ message: 'Please fill in all fields.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const company = await prisma.company.create({
      data: { name: companyName || 'My Finance Company' }
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'Super Admin', companyId: company.id }
    });

    res.status(201).json({ message: 'Account created', userId: user.id, companyId: company.id });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 2. LOGIN (email + password) ───────────────────────────────────────────
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 3. SEND OTP ───────────────────────────────────────────────────────────
// type: login_otp | forgot_password | email_verify
// channel: email | sms
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { email, phone, type, channel } = req.body;

    if (!type || !channel) {
      return res.status(400).json({ message: 'type and channel are required' });
    }
    if (channel === 'email' && !email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (channel === 'sms' && !phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // For login/forgot_password OTP — user must exist
    if (type === 'login_otp' || type === 'forgot_password') {
      const user = channel === 'email'
        ? await prisma.user.findUnique({ where: { email } })
        : await prisma.user.findFirst({ where: { phone } } as any);

      if (!user) {
        // Generic message to prevent email/phone enumeration
        return res.json({ message: 'If this account exists, an OTP has been sent.' });
      }
    }

    const code = generateOTP();
    await saveOTP({ email, phone, code, type });

    if (channel === 'email') {
      await sendEmailOTP(email, code, type);
    } else {
      await sendSMSOTP(phone, code, type);
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('SEND OTP ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
};

// ── 4. LOGIN WITH OTP ─────────────────────────────────────────────────────
export const loginWithOTP = async (req: Request, res: Response) => {
  try {
    const { email, phone, code, channel } = req.body;

    if (!code) return res.status(400).json({ message: 'OTP is required' });

    const result = await verifyOTP({
      email: channel === 'email' ? email : undefined,
      phone: channel === 'sms' ? phone : undefined,
      code,
      type: 'login_otp'
    });

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // Find the user
    const user = channel === 'email'
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findFirst({ where: { phone } } as any);

    if (!user) return res.status(400).json({ message: 'User not found' });

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('LOGIN OTP ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 5. FORGOT PASSWORD — VERIFY OTP + SET NEW PASSWORD ───────────────────
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, phone, code, newPassword, channel } = req.body;

    if (!code || !newPassword) {
      return res.status(400).json({ message: 'OTP and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const result = await verifyOTP({
      email: channel === 'email' ? email : undefined,
      phone: channel === 'sms' ? phone : undefined,
      code,
      type: 'forgot_password'
    });

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // Find user and update password
    const user = channel === 'email'
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findFirst({ where: { phone } } as any);

    if (!user) return res.status(400).json({ message: 'User not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── 6. VERIFY EMAIL OTP (during registration) ────────────────────────────
export const verifyEmailOTP = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    const result = await verifyOTP({ email, code, type: 'email_verify' });

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ message: 'Email verified successfully', verified: true });
  } catch (error) {
    console.error('VERIFY EMAIL OTP ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logLoginPhoto = async (req: any, res: Response) => {
  try {
    const { photoData } = req.body;
    if (!photoData) return res.status(400).json({ message: 'No photo provided' });

    await logAudit({
      req,
      action: 'login_photo',
      entityType: 'User',
      entityId: req.user.userId,
      photoData,
    });

    res.json({ saved: true });
  } catch (err) {
    console.error('LOGIN PHOTO LOG ERROR:', err);
    res.status(500).json({ message: 'Could not save login photo' });
  }
};