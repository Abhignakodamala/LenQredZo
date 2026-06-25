import prisma from '../../lib/prisma';
import { Response } from 'express';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';
import { customerScope, isBranchScoped } from '../../utils/scoping';
import { PrismaClient } from '@prisma/client';


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
    const customers = await prisma.customer.findMany({
      where: customerScope(req.user),
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
    // Multi-tenant + branch guard: don't reveal records outside the user's company/branch.
    if (customer.companyId !== req.user.companyId) return res.status(404).json({ message: 'Customer not found' });
    if (isBranchScoped(req.user) && customer.branchId !== req.user.branchId) {
      return res.status(404).json({ message: 'Customer not found' });
    }
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

export const bulkImportCustomers = async (req: any, res: Response) => {
  try {
    // Owner / managers only.
    const allowed = ['owner', 'admin', 'Super Admin', 'branch_manager'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to import customers' });
    }

    const companyId = req.user.companyId;
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ message: 'No rows to import. Please upload a filled template.' });
    }
    if (rows.length > 2000) {
      return res.status(400).json({ message: 'Too many rows. Please import at most 2000 at a time.' });
    }

    // Load this company's branches once, to resolve branch names -> ids.
    const branches = await prisma.branch.findMany({ where: { companyId } });
    const branchByName: Record<string, number> = {};
    branches.forEach(b => { branchByName[(b.name || '').trim().toLowerCase()] = b.id; });

    // Load existing customers for this company to prevent duplicates by phone or Aadhaar.
    // Aadhaar is stored encrypted; decrypt here to compare safely. This keeps the import idempotent.
    const existingCustomers = await prisma.customer.findMany({ where: { companyId }, select: { id: true, phone: true, aadhar: true } });
    const existingPhones = new Set(existingCustomers.map(c => (c.phone || '').trim()));
    const existingAadhaars = new Set<string>();
    existingCustomers.forEach(c => {
      if (c.aadhar) {
        try {
          const dec = decrypt(c.aadhar as string).replace(/\s/g, '').trim();
          if (dec) existingAadhaars.add(dec);
        } catch {
          // ignore decryption errors for legacy/tampered values
        }
      }
    });

    const added: string[] = [];
    const skipped: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const rowNum = i + 2; // +2 because row 1 is the header in the sheet

      const name = String(r.name ?? r.Name ?? '').trim();
      const phone = String(r.phone ?? r.Phone ?? '').trim();
      const email = String(r.email ?? r.Email ?? '').trim();
      const address = String(r.address ?? r.Address ?? '').trim();
      const aadhar = String(r.aadhar ?? r.Aadhaar ?? r.aadhaar ?? '').replace(/\s/g, '').trim();
      const pan = String(r.pan ?? r.PAN ?? r.Pan ?? '').trim();
      const branchName = String(r.branch ?? r.Branch ?? '').trim();

      // --- validation ---
      if (!name) { skipped.push({ row: rowNum, name: '(blank)', reason: 'Name is required' }); continue; }
      if (!phone) { skipped.push({ row: rowNum, name, reason: 'Phone is required' }); continue; }
      if (aadhar && !/^\d{12}$/.test(aadhar)) { skipped.push({ row: rowNum, name, reason: 'Aadhaar must be 12 digits' }); continue; }
      if (pan && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan)) { skipped.push({ row: rowNum, name, reason: 'PAN format looks invalid' }); continue; }

      // --- duplicate checks ---
      if (existingPhones.has(phone)) {
        skipped.push({ row: rowNum, name, reason: 'Duplicate phone' });
        continue;
      }
      if (aadhar) {
        const cleaned = aadhar.replace(/\s/g, '').trim();
        if (existingAadhaars.has(cleaned)) {
          skipped.push({ row: rowNum, name, reason: 'Duplicate Aadhaar' });
          continue;
        }
      }

      // --- resolve branch (optional) ---
      let branchId: number | null = null;
      if (branchName) {
        const found = branchByName[branchName.toLowerCase()];
        if (!found) { skipped.push({ row: rowNum, name, reason: `Branch "${branchName}" not found` }); continue; }
        branchId = found;
      }

      try {
        await prisma.customer.create({
          data: {
            name, email: email || null, phone, address: address || null,
            branchId, companyId,
            aadhar: aadhar ? encrypt(aadhar) : null,
            pan: pan ? encrypt(pan.toUpperCase()) : null
          }
        });
        added.push(name);

        // record this entry so subsequent rows in the same batch don't duplicate
        existingPhones.add(phone);
        if (aadhar) existingAadhaars.add(aadhar.replace(/\s/g, '').trim());
      } catch (e) {
        skipped.push({ row: rowNum, name, reason: 'Could not save (duplicate or bad data)' });
      }
    }

    await logAudit({
      req, action: 'BULK_IMPORT_CUSTOMERS', entityType: 'Customer', entityId: 0,
      details: `Bulk imported customers: ${added.length} added, ${skipped.length} skipped`
    });

    res.json({ addedCount: added.length, skippedCount: skipped.length, skipped });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
