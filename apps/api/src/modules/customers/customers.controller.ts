import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';

const prisma = new PrismaClient();

function toSafeCustomer(c: any) {
  return {
    ...c,
    aadhar: c.aadhar ? maskAadhaar(decrypt(c.aadhar)) : '',
    pan: c.pan ? maskPan(decrypt(c.pan)) : ''
  };
}

function isMasked(v: string): boolean {
  return typeof v === 'string' && v.includes('XXX');
}

export const getAllCustomers = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const customers = await prisma.customer.findMany({
      where: { companyId },
      include: { loans: true }
    });
    res.json(customers.map(toSafeCustomer));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getCustomerById = async (req: any, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        loans: {
          include: { payments: true, emis: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(toSafeCustomer(customer));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createCustomer = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const { name, email, phone, address, aadhar, pan, branchId } = req.body;
    const customer = await prisma.customer.create({
      data: {
        name, email, phone, address, branchId, companyId,
        aadhar: aadhar ? encrypt(aadhar) : null,
        pan: pan ? encrypt(pan) : null
      }
    });

    await logAudit({
      req, action: 'CREATE_CUSTOMER', entityType: 'Customer', entityId: customer.id,
      details: `Created customer ${customer.name} (#${customer.id})`
    });

    res.status(201).json({ message: 'Customer created', customer: toSafeCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateCustomer = async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, address, aadhar, pan, branchId } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Customer not found' });

    const data: any = {};
    const changed: string[] = [];

    if (name !== undefined && name !== existing.name) { data.name = name; changed.push('name'); }
    if (email !== undefined && email !== existing.email) { data.email = email; changed.push('email'); }
    if (phone !== undefined && phone !== existing.phone) { data.phone = phone; changed.push('phone'); }
    if (address !== undefined && address !== existing.address) { data.address = address; changed.push('address'); }
    if (branchId !== undefined && branchId !== existing.branchId) { data.branchId = branchId; changed.push('branch'); }

    // Aadhaar/PAN: only if a real new value actually differs from the stored one
    if (aadhar && !isMasked(aadhar)) {
      const currentAadhar = existing.aadhar ? decrypt(existing.aadhar) : '';
      if (aadhar !== currentAadhar) { data.aadhar = encrypt(aadhar); changed.push('aadhaar'); }
    }
    if (pan && !isMasked(pan)) {
      const currentPan = existing.pan ? decrypt(existing.pan) : '';
      if (pan !== currentPan) { data.pan = encrypt(pan); changed.push('pan'); }
    }

    const customer = await prisma.customer.update({ where: { id }, data });

    // Only log if something genuinely changed; name it by customer, list only changed fields.
    if (changed.length > 0) {
      await logAudit({
        req, action: 'UPDATE_CUSTOMER', entityType: 'Customer', entityId: id,
        details: `Updated ${existing.name} (#${id}) — changed: ${changed.join(', ')}`
      });
    }

    res.json({ message: 'Customer updated', customer: toSafeCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteCustomer = async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id }, select: { name: true } });

    await prisma.customer.delete({ where: { id } });

    await logAudit({
      req, action: 'DELETE_CUSTOMER', entityType: 'Customer', entityId: id,
      details: `Deleted customer ${existing?.name || ''} (#${id})`
    });

    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};