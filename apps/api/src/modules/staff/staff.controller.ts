import { Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import { ROLES } from '../../utils/permissions';

const prisma = new PrismaClient();

// Roles an owner is allowed to assign through this screen (not Super Admin / platform).
const ASSIGNABLE_ROLES = ['branch_manager', 'loan_officer', 'accountant', 'collection_agent', 'recovery_officer', 'owner'];

function safeUser(u: any) {
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role, branchId: u.branchId, branch: u.branch || null,
    createdAt: u.createdAt
  };
}

// GET /api/staff — everyone in the company
export const getStaff = async (req: any, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId },
      include: { branch: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(users.map(safeUser));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/staff — create a staff member
export const createStaff = async (req: any, res: Response) => {
  try {
    const { name, email, password, role, branchId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password and role are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed, role,
        companyId: req.user.companyId,
        branchId: branchId ? Number(branchId) : null
      },
      include: { branch: true }
    });

    await logAudit({
      req, action: 'CREATE_STAFF', entityType: 'User', entityId: user.id,
      details: `Added staff ${name} (${email}) as ${role}`
    });

    res.status(201).json({ message: 'Staff member created', user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/staff/:id — change role or branch
export const updateStaff = async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { role, branchId } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    // Don't let an owner change their own role and lock themselves out.
    if (target.id === req.user.userId && role && role !== target.role) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }
    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const data: any = {};
    const changed: string[] = [];
    if (role && role !== target.role) { data.role = role; changed.push('role'); }
    const newBranch = branchId === null || branchId === '' ? null : (branchId != null ? Number(branchId) : undefined);
    if (newBranch !== undefined && newBranch !== target.branchId) { data.branchId = newBranch; changed.push('branch'); }

    const user = await prisma.user.update({
      where: { id }, data, include: { branch: true }
    });

    if (changed.length > 0) {
      await logAudit({
        req, action: 'UPDATE_STAFF', entityType: 'User', entityId: id,
        details: `Updated staff ${target.name} (#${id}) — changed: ${changed.join(', ')}`
      });
    }

    res.json({ message: 'Staff member updated', user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};