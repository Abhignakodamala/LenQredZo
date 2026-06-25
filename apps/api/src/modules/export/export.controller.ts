import prisma from '../../lib/prisma';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import { decrypt } from '../../utils/encryption';


const fmtDate = (d: any) => (d ? new Date(d).toLocaleString('en-IN') : '');

export const exportCompanyData = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;

    // Pull everything for this company, in parallel. Cast to any[] so we can
    // read fields defensively without fighting exact schema typings.
    const [company, customers, loans, emis, payments, guarantors] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }) as any,
      prisma.customer.findMany({ where: { companyId } }) as any,
      prisma.loan.findMany({ where: { companyId }, include: { customer: true } }) as any,
      prisma.eMI.findMany({
        where: { loan: { companyId } },
        include: { loan: { include: { customer: true } } }
      }) as any,
      prisma.payment.findMany({
        where: { loan: { companyId } },
        include: { loan: { include: { customer: true } } }
      }) as any,
      prisma.guarantor.findMany({
        where: { loan: { companyId } },
        include: { loan: { include: { customer: true } } }
      }) as any
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'FinSmart AI';
    wb.created = new Date();

    // --- Customers ---
    const cs = wb.addWorksheet('Customers');
    cs.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Aadhaar', key: 'aadhar', width: 18 },
      { header: 'PAN', key: 'pan', width: 14 },
      { header: 'Address', key: 'address', width: 30 }
    ];
    customers.forEach((c: any) => cs.addRow({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      aadhar: c.aadhar ? decrypt(c.aadhar) : '',
      pan: c.pan ? decrypt(c.pan) : '',
      address: c.address || ''
    }));

    // --- Loans ---
    const ls = wb.addWorksheet('Loans');
    ls.columns = [
      { header: 'Loan ID', key: 'lid', width: 12 },
      { header: 'Customer', key: 'cust', width: 24 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Disbursed', key: 'disbursed', width: 14 },
      { header: 'Interest Rate (%)', key: 'rate', width: 16 },
      { header: 'Interest Type', key: 'itype', width: 16 },
      { header: 'Frequency', key: 'freq', width: 12 },
      { header: 'Tenure', key: 'tenure', width: 10 },
      { header: 'Processing Fee', key: 'pf', width: 14 },
      { header: 'Penalty Type', key: 'ptype', width: 14 },
      { header: 'Penalty Value', key: 'pval', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created', key: 'created', width: 22 }
    ];
    loans.forEach((l: any) => ls.addRow({
      lid: 'LN' + (1000 + l.id),
      cust: l.customer?.name || '',
      type: l.type,
      amount: l.amount,
      disbursed: l.disbursedAmount ?? l.amount,
      rate: l.interestRate,
      itype: l.interestType === 'flat' ? 'Flat Rate' : 'Reducing Balance',
      freq: l.frequency,
      tenure: l.tenure,
      pf: l.processingFee || 0,
      ptype: l.penaltyType,
      pval: l.penaltyValue || 0,
      status: l.status,
      created: fmtDate(l.createdAt)
    }));

    // --- EMI Schedule ---
    const es = wb.addWorksheet('EMI Schedule');
    es.columns = [
      { header: 'Loan ID', key: 'lid', width: 12 },
      { header: 'Customer', key: 'cust', width: 24 },
      { header: 'Due Date', key: 'due', width: 16 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Penalty', key: 'penalty', width: 12 },
      { header: 'Penalty Paid', key: 'penaltyPaid', width: 14 }
    ];
    emis.forEach((e: any) => es.addRow({
      lid: 'LN' + (1000 + (e.loan?.id ?? e.loanId)),
      cust: e.loan?.customer?.name || '',
      due: e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-IN') : '',
      amount: e.amount,
      status: e.status,
      penalty: e.penalty || 0,
      penaltyPaid: e.penaltyPaid ? 'Yes' : 'No'
    }));

    // --- Payments ---
    const ps = wb.addWorksheet('Payments');
    ps.columns = [
      { header: 'Loan ID', key: 'lid', width: 12 },
      { header: 'Customer', key: 'cust', width: 24 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Method', key: 'method', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Paid At', key: 'paidAt', width: 22 }
    ];
    payments.forEach((p: any) => ps.addRow({
      lid: 'LN' + (1000 + (p.loan?.id ?? p.loanId)),
      cust: p.loan?.customer?.name || '',
      amount: p.amount,
      method: p.method || '',
      status: p.status || '',
      paidAt: fmtDate(p.paidAt)
    }));

    // --- Guarantors ---
    const gs = wb.addWorksheet('Guarantors');
    gs.columns = [
      { header: 'Loan ID', key: 'lid', width: 12 },
      { header: 'Borrower', key: 'borrower', width: 24 },
      { header: 'Guarantor Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Relationship', key: 'rel', width: 18 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Aadhaar', key: 'aadhar', width: 18 },
      { header: 'PAN', key: 'pan', width: 14 },
      { header: 'Address', key: 'address', width: 30 }
    ];
    guarantors.forEach((g: any) => gs.addRow({
      lid: 'LN' + (1000 + (g.loan?.id ?? g.loanId)),
      borrower: g.loan?.customer?.name || '',
      name: g.name,
      phone: g.phone,
      rel: g.relationship || '',
      type: g.type || '',
      aadhar: g.aadhar ? decrypt(g.aadhar) : '',
      pan: g.pan ? decrypt(g.pan) : '',
      address: g.address || ''
    }));

    // Style every header row
    wb.eachSheet((sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      headerRow.alignment = { vertical: 'middle' };
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeCompany = (company?.name || 'finsmart').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${safeCompany}-export-${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('EXPORT ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
