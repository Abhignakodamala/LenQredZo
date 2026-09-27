import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { logAudit } from '../../utils/audit'; // adjust path to match your existing convention

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body; // the ID token JWT from Google Identity Services
    if (!credential) return res.status(400).json({ message: 'Missing Google credential' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ message: 'Could not read Google account email' });
    if (!payload.email_verified) return res.status(400).json({ message: 'Google account email is not verified' });

    // Deliberately does NOT auto-create accounts — LenQredzo staff are added by an owner/admin,
    // not self-registered via Google. Same access model as your existing password/OTP login.
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      return res.status(404).json({ message: 'No LenQredzo account found for this Google email. Ask your admin to add you first.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    await logAudit({ req, action: 'login_google', entityType: 'User', entityId: user.id,  details: 'User logged in with Google'  });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
    });
  } catch (err: any) {
    console.error('GOOGLE LOGIN ERROR:', err);
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
};