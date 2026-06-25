import prisma from '../../lib/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


// Fail fast at startup: if the signing secret isn't set, the server must
// not run at all rather than silently fall back to a guessable key.
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set in the environment. Refusing to start without a signing secret. ' +
    'Add JWT_SECRET to your .env file.'
  );
}

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, companyName, accessCode } = req.body;

    // --- Access-code gate: only people with your secret code can create a company ---
    const REQUIRED_CODE = process.env.SIGNUP_ACCESS_CODE || '';
    if (!REQUIRED_CODE || accessCode !== REQUIRED_CODE) {
      return res.status(403).json({ message: 'Invalid or missing access code. Contact FinSmart to get one.' });
    }

    // --- Basic validation ---
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

    // Self sign-up always creates the company OWNER. Role is forced, never taken from the client.
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'Super Admin', companyId: company.id }
    });

    res.status(201).json({ message: 'User and company created', userId: user.id, companyId: company.id });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId },
       process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId } });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
