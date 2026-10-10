import { Request } from 'express';
import prisma from '../../lib/prisma';

export async function recordSuccessfulLogin(req: Request, userId: number, method: string) {
  try {
    await prisma.loginEvent.create({
      data: {
        userId,
        method,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      },
    });
  } catch (error) {
    console.error('LOGIN EVENT RECORD ERROR:', error);
  }
}
