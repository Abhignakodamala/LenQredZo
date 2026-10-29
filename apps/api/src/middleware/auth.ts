import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set in the environment. Refusing to start without a verification secret. ' +
    'Add JWT_SECRET to your .env file.'
  );
}

import prisma from '../lib/prisma';

export const protect = async (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token, access denied' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;

    if (userId) {
      // Real-time verification: check user still exists and fetch active company/branch
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, companyId: true, branchId: true }
      });

      if (!user) {
        return res.status(401).json({ message: 'Session expired: User account is inactive or no longer exists.' });
      }

      req.user = {
        ...decoded,
        role: user.role,
        companyId: user.companyId,
        branchId: user.branchId
      };
    } else {
      req.user = decoded;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};