import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';

const prisma = new PrismaClient();

// Returns a customer object safe to send to the browser:
// PII decrypted then masked, so full Aadhaar/PAN never leave the server.
function toSafeCustomer(c: any) {
  return {
    ...c,
    aadhar: c.aadhar ? maskAadhaar(decrypt(c.aadhar)) : '',
    pan: c.pan ? maskPan(decrypt(c.pan)) : ''
  };
}

// True if a value looks like a mask (came back from the UI unchanged).
// Real Aadhaar is digits only and real PAN never contains 'XXX',
// so this safely distinguishes a masked value from a newly typed one.
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
      include: { loans: true }
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
    res.status(201).json({ message: 'Customer created', customer: toSafeCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateCustomer = async (req: any, res: Response) => {
  try {
    const { name, email, phone, address, aadhar, pan, branchId } = req.body;

    // Build the update explicitly — never spread req.body, which would let a
    // client overwrite protected fields like companyId or id.
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (branchId !== undefined) data.branchId = branchId;

    // Only (re)encrypt PII when a real, newly-typed value is sent.
    // If the UI submits the masked value unchanged, leave the stored
    // encrypted value as-is so we never overwrite it with "XXXX...".
    if (aadhar && !isMasked(aadhar)) data.aadhar = encrypt(aadhar);
    if (pan && !isMasked(pan)) data.pan = encrypt(pan);

    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json({ message: 'Customer updated', customer: toSafeCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteCustomer = async (req: any, res: Response) => {
  try {
    await prisma.customer.delete({
      where: { id: Number(req.params.id) }
    });
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};