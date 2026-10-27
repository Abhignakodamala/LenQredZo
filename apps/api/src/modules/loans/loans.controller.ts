import prisma from '../../lib/prisma';
import { Response } from 'express';
import { encrypt, decrypt, maskAadhaar, maskPan } from '../../utils/encryption';
import { logAudit } from '../../utils/audit';
import { loanScope, emiScope, paymentScope, isBranchScoped } from '../../utils/scoping';
import { validateReference } from '../../utils/refcheck';
import { runMidnightPenaltyAccrual } from '../../services/penalty-cron.service';


// --- PII helpers: decrypt + mask before sending to the browser ---
function safeDecrypt(val?: string | null): string {
  if (!val) return '';
  try {
    return decrypt(val);
  } catch {
    return val;
  }
}

function maskCustomer(c: any) {
  if (!c) return c;
  const rawBank = safeDecrypt(c.bankAccountNumber);
  return {
    ...c,
    aadhar: c.aadhar ? maskAadhaar(safeDecrypt(c.aadhar)) : '',
    pan: c.pan ? maskPan(safeDecrypt(c.pan)) : '',
    bankAccountNumber: rawBank ? (rawBank.length <= 4 ? rawBank : `XXXX-XXXX-${rawBank.slice(-4)}`) : ''
  };
}

function maskGuarantor(g: any) {
  if (!g) return g;
  return {
    ...g,
    aadhar: g.aadhar ? maskAadhaar(decrypt(g.aadhar)) : '',
    pan: g.pan ? maskPan(decrypt(g.pan)) : ''
  };
}

const getPeriodsPerYear = (frequency: string) => {
  if (frequency === 'daily') return 365;
  if (frequency === 'weekly') return 52;
  return 12;
};

const calculateInstallment = (
  principal: number, rate: number, tenure: number,
  interestType: string, frequency: string, deductUpfront: boolean
): { emiAmount: number; disbursedAmount: number } => {
  let emiAmount: number;
  let disbursedAmount = principal;
  const periodsPerYear = getPeriodsPerYear(frequency);

  if (interestType === 'flat') {
    const totalInterest = principal * (rate / 100) * (tenure / periodsPerYear);
    if (deductUpfront) {
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      emiAmount = (principal + totalInterest) / tenure;
    }
  } else {
    const periodRate = rate / periodsPerYear / 100;
    if (deductUpfront) {
      const totalInterest = principal * (rate / 100) * (tenure / periodsPerYear);
      disbursedAmount = principal - totalInterest;
      emiAmount = principal / tenure;
    } else {
      emiAmount = periodRate === 0
        ? principal / tenure
        : (principal * periodRate * Math.pow(1 + periodRate, tenure)) / (Math.pow(1 + periodRate, tenure) - 1);
    }
  }

  return { emiAmount: Math.round(emiAmount), disbursedAmount: Math.round(disbursedAmount) };
};

const getNextDueDate = (startDate: Date, index: number, frequency: string): Date => {
  const date = new Date(startDate);
  if (frequency === 'daily') date.setDate(date.getDate() + index);
  else if (frequency === 'weekly') date.setDate(date.getDate() + index * 7);
  else date.setMonth(date.getMonth() + index);
  return date;
};

const calculatePenalty = (emi: any, loan: any, today: Date): number => {
  if (emi.status === 'paid' || new Date(emi.dueDate) >= today) return 0;
  const daysOverdue = Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000);
  if (loan.penaltyType === 'fixed') return loan.penaltyValue;
  if (loan.penaltyType === 'percentage') return Math.round(emi.amount * loan.penaltyValue / 100);
  if (loan.penaltyType === 'daily') return Math.round(daysOverdue * loan.penaltyValue);
  return 0;
};

export const createLoan = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const {
      customerId, type, amount, interestRate,
      interestType = 'percentage', frequency = 'monthly',
      tenure, deductUpfront = false,
      processingFee = 0, processingFeeType = 'percentage',
      penaltyType = 'none', penaltyValue = 0,
      roundEmi = false,
      guarantors = []
    } = req.body;

    
    const { emiAmount, disbursedAmount: baseDisburse } = calculateInstallment(
      amount, interestRate, tenure, interestType, frequency, deductUpfront
    );
    
    if (processingFeeType === 'percentage' && processingFee > 10) {
      return res.status(400).json({ message: 'Processing fee cannot exceed 10% of the loan amount.' });
    }

    const processingFeeAmount = processingFeeType === 'percentage'
      ? Math.round(amount * processingFee / 100)
      : Math.round(processingFee);

    const finalDisbursed = baseDisburse - processingFeeAmount;
    if (finalDisbursed <= 0) {
      return res.status(400).json({
        message: `Upfront deductions (interest + processing fee) exceed the loan amount — the customer would receive ₹${finalDisbursed.toLocaleString('en-IN')}. Reduce the interest rate, lower the processing fee, or turn off "Deduct Interest Upfront".`
      });
    }
    const loan = await prisma.loan.create({
      data: {
        customerId, type, amount, disbursedAmount: finalDisbursed,
        interestRate, interestType, frequency,
        deductUpfront, tenure, status: 'active', companyId,
        processingFee: processingFeeAmount,
        processingFeeType, penaltyType, penaltyValue, roundEmi
      }
    });

    const startDate = new Date();
    const roundedEmi = Math.round(emiAmount);
    const totalRepayable = Math.round(emiAmount * tenure);
    const emis = [];
    if (roundEmi) {
      const roundedEmi = Math.round(emiAmount);
      const totalRepayable = Math.round(emiAmount * tenure);
      for (let i = 1; i <= tenure; i++) {
        const isLast = i === tenure;
        const thisAmount = isLast ? (totalRepayable - roundedEmi * (tenure - 1)) : roundedEmi;
        emis.push({ loanId: loan.id, amount: thisAmount, dueDate: getNextDueDate(startDate, i, frequency), status: 'pending' });
      }
    } else {
      for (let i = 1; i <= tenure; i++) {
        emis.push({ loanId: loan.id, amount: emiAmount, dueDate: getNextDueDate(startDate, i, frequency), status: 'pending' });
      }
    }
    await prisma.eMI.createMany({ data: emis });

    // Save guarantors — Aadhaar/PAN encrypted at rest
    await prisma.guarantor.createMany({
      data: guarantors.map((g: any) => ({
        loanId: loan.id,
        name: g.name,
        phone: g.phone,
        address: g.address || null,
        aadhar: g.aadhar ? encrypt(g.aadhar) : null,
        pan: g.pan ? encrypt(g.pan) : null,
        relationship: g.relationship || null,
        type: g.type || 'guarantor'
      }))
    });

    await logAudit({
      req, action: 'CREATE_LOAN', entityType: 'Loan', entityId: loan.id,
      details: `Created ${type} loan LN${1000 + loan.id} of ₹${amount} for customer #${customerId}`
    });

    res.status(201).json({ message: 'Loan created successfully', loan, emiAmount, disbursedAmount: finalDisbursed, processingFeeAmount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getAllLoans = async (req: any, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      where: loanScope(req.user),
      include: { customer: true, emis: true }
    });
    res.json(loans.map(l => ({ ...l, customer: maskCustomer(l.customer) })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLoanById = async (req: any, res: Response) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        customer: true,
        emis: { orderBy: { dueDate: 'asc' } },
        payments: true,
        guarantors: true,
        company: true
      }
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });

    // Branch isolation: block opening a loan outside the user's company/branch.
    if (loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    if (isBranchScoped(req.user) && loan.customer?.branchId !== req.user.branchId) {
      return res.status(403).json({ message: 'This loan belongs to another branch' });
    }

    let disbursalVoucher = null;
    if (loan.disbursedAt) {
      const audit = await prisma.auditLog.findFirst({
        where: {
          companyId: loan.companyId || req.user.companyId,
          entityType: 'Loan',
          entityId: loan.id,
          action: 'DISBURSE_LOAN'
        },
        orderBy: { createdAt: 'desc' }
      });
      if (audit && audit.details) {
        try {
          disbursalVoucher = JSON.parse(audit.details);
        } catch {
          disbursalVoucher = { summary: audit.details };
        }
      }
    }

    const safe = {
      ...loan,
      customer: maskCustomer(loan.customer),
      guarantors: (loan.guarantors || []).map(maskGuarantor),
      disbursalVoucher
    };
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateLoanStatus = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const existing = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!existing || existing.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const ALLOWED_STATUSES = ['pending', 'approved', 'disbursed', 'rejected', 'completed', 'cancelled'];
    if (!ALLOWED_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: { status: req.body.status }
    });
    await logAudit({
      req, action: 'UPDATE_LOAN_STATUS', entityType: 'Loan', entityId: loan.id,
      details: `Loan LN${1000 + loan.id} status changed to ${req.body.status}`
    });
    res.json({ message: 'Loan status updated', loan });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const disburseLoan = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const { payoutMode = 'IMPS', notes = '' } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { customer: true, company: true, emis: true }
    });

    if (!loan) return res.status(404).json({ success: false, error: 'Loan not found' });
    if (loan.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to loan' });
    }
    if (isBranchScoped(req.user) && loan.customer?.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, error: 'This loan belongs to another branch' });
    }

    // 1. Status checks
    if (loan.status === 'completed' || loan.disbursedAt) {
      return res.status(400).json({ success: false, error: 'This loan has already been disbursed.' });
    }
    if (loan.status === 'rejected' || loan.status === 'cancelled') {
      return res.status(400).json({ success: false, error: `Cannot disburse a ${loan.status} loan.` });
    }

    const customer = loan.customer;
    if (!customer) {
      return res.status(400).json({ success: false, error: 'Borrower customer record not found.' });
    }

    // 2. Strict RBI Digital Lending Compliance Check: Bank Verification
    const isBankVerified = customer.bankAccountStatus === 'verified';
    if (!isBankVerified) {
      return res.status(400).json({
        success: false,
        error: 'RBI Compliance Block: Cannot disburse funds to an unverified bank account. Please verify borrower bank details via ₹1 UPI QR or Penny Drop first.'
      });
    }

    const rawBankAcc = safeDecrypt(customer.bankAccountNumber);
    const bankIfsc = customer.bankIfsc || '';
    const bankName = customer.bankName || 'Borrower Bank';
    const beneficiaryName = customer.bankBeneficiaryName || customer.name;

    if (!rawBankAcc || !bankIfsc) {
      return res.status(400).json({
        success: false,
        error: 'Incomplete bank particulars: Account Number and IFSC are required for disbursement.'
      });
    }

    // 3. Financial calculations
    const grossSanctionAmount = loan.amount;
    const processingFee = loan.processingFee || 0;
    const upfrontInterest = loan.deductUpfront
      ? (loan.interestType === 'flat'
          ? Math.round(grossSanctionAmount * (loan.interestRate / 100) * (loan.tenure / (loan.frequency === 'daily' ? 365 : loan.frequency === 'weekly' ? 52 : 12)))
          : 0)
      : 0;
    const totalDeductions = processingFee + upfrontInterest;
    const netCreditAmount = grossSanctionAmount - totalDeductions;

    if (netCreditAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Total deductions exceed the loan sanction amount.'
      });
    }

    // 4. Generate Bank UTR reference & Payout simulation
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const utr = `UTR${datePrefix}${randomSuffix}`;

    const maskedAcc = rawBankAcc.length <= 4 ? rawBankAcc : `XXXX-XXXX-${rawBankAcc.slice(-4)}`;

    const voucherData = {
      utr,
      payoutMode: String(payoutMode).toUpperCase(),
      payoutStatus: 'SUCCESS',
      disbursedAt: now.toISOString(),
      disbursedBy: req.user.name || 'Branch Operations',
      disbursedByRole: req.user.role || 'Officer',
      loanId: loan.id,
      loanReference: `LN${1000 + loan.id}`,
      borrowerId: customer.id,
      borrowerName: customer.name,
      borrowerPhone: customer.phone,
      beneficiaryName,
      bankName,
      bankIfsc,
      maskedAccount: maskedAcc,
      grossSanctionAmount,
      processingFee,
      upfrontInterest,
      totalDeductions,
      netCreditAmount,
      tenure: loan.tenure,
      frequency: loan.frequency,
      interestRate: loan.interestRate,
      notes: notes || 'Instant RBI-compliant loan disbursement via IMPS payout gateway.'
    };

    // 5. Update Loan status and recalculate EMI due dates from disbursal date
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: 'active',
        disbursedAt: now,
        disbursedAmount: netCreditAmount
      }
    });

    // Update existing EMIs to align with new disbursal date
    if (loan.emis && loan.emis.length > 0) {
      for (let i = 0; i < loan.emis.length; i++) {
        const emi = loan.emis[i];
        if (emi.status === 'pending') {
          const newDueDate = getNextDueDate(now, i + 1, loan.frequency);
          await prisma.eMI.update({
            where: { id: emi.id },
            data: { dueDate: newDueDate }
          });
        }
      }
    }

    // 6. Log Audit Event with full structured voucher
    await logAudit({
      req,
      action: 'DISBURSE_LOAN',
      entityType: 'Loan',
      entityId: loan.id,
      details: JSON.stringify(voucherData)
    });

    res.json({
      success: true,
      message: `Loan LN${1000 + loan.id} successfully disbursed via ${payoutMode}!`,
      voucher: voucherData,
      loan: updatedLoan
    });
  } catch (error: any) {
    console.error('Loan disbursal error:', error);
    res.status(500).json({ success: false, error: error.message || 'Disbursal failed' });
  }
};

export const markEmiPaid = async (req: any, res: Response) => {
  try {
    const emiId = Number(req.params.emiId);
    const { collectPenalty = false, waivePenalty = false, waiveReason = '' } = req.body;
    const method = (req.body.method || 'cash').toLowerCase();
    const reference = (req.body.reference || '').trim();

    // Validate the reference format if a digital payment method is used.
    if (method !== 'cash' && reference) {
      const { ok, message } = validateReference(method, reference);
      if (!ok) {
        return res.status(400).json({ message });
      }
    }

    // Validate the reference format (Level 2 — catches obviously-fake references).
    const refCheck = validateReference(method, reference);
    if (!refCheck.ok) {
      return res.status(400).json({ message: refCheck.message });
    }
    // "referenceRecorded": a digital payment with a well-formed reference. This means the
    // reference was captured and passes a format check — NOT that the bank confirmed it.
    // True confirmation requires a payment gateway (Pro feature).
    const verified = method !== 'cash' && reference.length > 0;

    const emi = await prisma.eMI.findUnique({
      where: { id: emiId },
      include: { loan: true }
    });
    if (!emi || emi.loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'EMI not found' });
    }
    if (emi.status === 'paid') return res.status(400).json({ message: 'EMI is already fully paid' });

    const alreadyPaid = emi.paidAmount || 0;
    const remaining = emi.amount - alreadyPaid;

    // Amount being paid this time. If the frontend sends nothing, default to clearing the full remaining balance.
    const payAmount = req.body.amount != null ? Math.round(Number(req.body.amount)) : remaining;

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid payment amount' });
    }
    if (payAmount > remaining) {
      return res.status(400).json({ message: `Amount exceeds the remaining balance of ₹${remaining.toLocaleString('en-IN')}` });
    }

    const newPaid = alreadyPaid + payAmount;
    const fullyCleared = newPaid >= emi.amount;

    // Penalty is only collected when the EMI is fully cleared (v1 rule).
    const today = new Date();
    // Penalty waiver: only managers/owners may waive, reason required, fully audited.
    const canWaive = ['owner', 'admin', 'Super Admin', 'branch_manager'].includes(req.user.role);
    const isWaiving = fullyCleared && collectPenalty && waivePenalty;
    if (isWaiving && !canWaive) {
      return res.status(403).json({ message: 'You do not have permission to waive penalties' });
    }
    if (isWaiving && !waiveReason.trim()) {
      return res.status(400).json({ message: 'A reason is required to waive the penalty' });
    }
    const penaltyAmount = (fullyCleared && collectPenalty && !isWaiving) ? calculatePenalty(emi, emi.loan, today) : 0;
    const waivedAmount = isWaiving ? calculatePenalty(emi, emi.loan, today) : 0;
    const paymentTotal = payAmount + penaltyAmount;

    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.eMI.findUnique({ where: { id: emiId } });
      if (!fresh || fresh.status === 'paid') {
        throw new Error('ALREADY_PAID');
      }

      await tx.eMI.update({
        where: { id: emiId },
        data: {
          paidAmount: newPaid,
          status: fullyCleared ? 'paid' : 'partial',
          ...(fullyCleared ? { penalty: penaltyAmount, penaltyPaid: collectPenalty } : {})
        }
      });

      await tx.payment.create({
        data: {
          loanId: emi.loanId, amount: paymentTotal,
          method, reference: reference || null, verified,
          status: 'completed', paidAt: new Date()
        }
      });

      const remainingEmis = await tx.eMI.count({
        where: { loanId: emi.loanId, status: { not: 'paid' } }
      });

      let loanCompleted = false;
      if (remainingEmis === 0) {
        await tx.loan.update({
          where: { id: emi.loanId },
          data: { status: 'completed' }
        });
        loanCompleted = true;
      }

      return { loanCompleted };
    });

    const partialNote = fullyCleared ? '' : ` (partial — ₹${(emi.amount - newPaid).toLocaleString('en-IN')} still due)`;
    if (isWaiving && waivedAmount > 0) {
      await logAudit({
        req, action: 'WAIVE_PENALTY', entityType: 'EMI', entityId: emiId,
        details: `Waived ₹${waivedAmount.toLocaleString('en-IN')} penalty on loan LN${1000 + emi.loanId} — reason: ${waiveReason.trim()}`,
        photoData: req.body.verificationPhoto
      });
    }
    await logAudit({
      req, action: 'MARK_EMI_PAID', entityType: 'EMI', entityId: emiId,
      details: `Collected ₹${paymentTotal.toLocaleString('en-IN')} via ${method}${reference ? ' (ref: ' + reference + ')' : ''}${method === 'cash' ? ' [unverified cash]' : ''} on loan LN${1000 + emi.loanId}${partialNote}${result.loanCompleted ? ' — loan completed' : ''}`,
      photoData: req.body.verificationPhoto
    });

    res.json({
      message: fullyCleared ? 'EMI fully paid' : 'Partial payment recorded',
      payAmount,
      penaltyAmount,
      paymentTotal,
      waivedAmount,
      paidAmount: newPaid,
      remaining: emi.amount - newPaid,
      status: fullyCleared ? 'paid' : 'partial',
      method,
      verified,
      loanCompleted: result.loanCompleted
    });
  } catch (error: any) {
    if (error?.message === 'ALREADY_PAID') {
      return res.status(400).json({ message: 'EMI is already fully paid' });
    }
    console.error('MARK EMI PAID ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCollections = async (req: any, res: Response) => {
  try {
    const emis = await prisma.eMI.findMany({
      where: emiScope(req.user),
      include: {
        loan: {
          include: {
            customer: { include: { branch: true } },
            company: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    const today = new Date();
    const result = emis.map(emi => {
      const paidAmount = emi.paidAmount || 0;
      const remaining = emi.amount - paidAmount;
      const isOverdue = emi.status !== 'paid' && new Date(emi.dueDate) < today;
      let status: string;
      if (emi.status === 'paid') status = 'paid';
      else if (paidAmount > 0) status = 'partial';
      else if (isOverdue) status = 'overdue';
      else status = 'pending';
      const daysOverdue = isOverdue
        ? Math.floor((today.getTime() - new Date(emi.dueDate).getTime()) / 86400000)
        : 0;
      const penalty = emi.status === 'paid' ? 0 : calculatePenalty(emi, emi.loan, today);
      const addressParts = [
        emi.loan.customer?.street,
        emi.loan.customer?.address,
        emi.loan.customer?.city
      ].filter(Boolean);
      return {
        id: emi.id,
        customerName: emi.loan.customer?.name || 'Unknown',
        customerPhone: emi.loan.customer?.phone || '',
        customerAddress: addressParts.length > 0 ? addressParts.join(', ') : '—',
        branchName: emi.loan.customer?.branch?.name || 'Headquarters',
        companyName: emi.loan.company?.name || 'LenQredzo Finance',
        loanId: emi.loan.id,
        loanType: emi.loan.type || 'Personal Loan',
        frequency: emi.loan.frequency || 'monthly',
        tenure: emi.loan.tenure || 1,
        dueDate: emi.dueDate,
        amount: emi.amount,
        paidAmount,
        remaining,
        penalty,
        totalDue: remaining + penalty,
        daysOverdue,
        status,
        penaltyType: emi.loan.penaltyType,
        penaltyPaid: emi.penaltyPaid
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getPayments = async (req: any, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: paymentScope(req.user),
      include: { loan: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' }
    });
    res.json(payments.map(p => ({
      ...p,
      loan: p.loan ? { ...p.loan, customer: maskCustomer((p.loan as any).customer) } : p.loan
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteLoan = async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const allowed = ['owner', 'admin', 'Super Admin', 'branch_manager'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to delete loans' });
    }
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    // Remove child records first (DB blocks deleting a loan while these exist), then the loan.
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { loanId: id } }),
      prisma.eMI.deleteMany({ where: { loanId: id } }),
      prisma.guarantor.deleteMany({ where: { loanId: id } }),
      prisma.loan.delete({ where: { id } })
    ]);
    await logAudit({
      req, action: 'DELETE_LOAN', entityType: 'Loan', entityId: id,
      details: `Deleted loan LN${1000 + id} (${loan.type}, ₹${loan.amount})`
    });
    res.json({ message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addGuarantorToLoan = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const {
      name, relationship, dateOfBirth, aadhar, pan, phone, email,
      address, city, pinCode, employmentType, employerName,
      grossAnnualIncome, bankName, bankAccountNumber, consentGiven, type = 'guarantor'
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Guarantor name and phone number are required' });
    }

    const guarantor = await prisma.guarantor.create({
      data: {
        loanId,
        name: name.trim(),
        relationship: relationship ? relationship.trim() : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        aadhar: aadhar ? encrypt(aadhar) : null,
        pan: pan ? encrypt(pan) : null,
        phone: phone.trim(),
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        pinCode: pinCode ? pinCode.trim() : null,
        employmentType: employmentType || null,
        employerName: employerName ? employerName.trim() : null,
        grossAnnualIncome: grossAnnualIncome ? Number(grossAnnualIncome) : null,
        bankName: bankName ? bankName.trim() : null,
        bankAccountNumber: bankAccountNumber ? encrypt(bankAccountNumber) : null,
        consentGiven: Boolean(consentGiven),
        consentDate: consentGiven ? new Date() : null,
        type: type || 'guarantor'
      }
    });

    await logAudit({
      req,
      action: 'ADD_GUARANTOR',
      entityType: 'Guarantor',
      entityId: guarantor.id,
      details: `Added guarantor ${guarantor.name} (${guarantor.relationship || 'Surety'}) to loan LN${1000 + loanId}`
    });

    res.status(201).json({ message: 'Guarantor attached successfully', guarantor: maskGuarantor(guarantor) });
  } catch (error: any) {
    console.error('Add guarantor error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const updateGuarantor = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const guarantorId = Number(req.params.guarantorId);

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const existing = await prisma.guarantor.findUnique({ where: { id: guarantorId } });
    if (!existing || existing.loanId !== loanId) {
      return res.status(404).json({ message: 'Guarantor not found on this loan' });
    }

    const {
      name, relationship, dateOfBirth, aadhar, pan, phone, email,
      address, city, pinCode, employmentType, employerName,
      grossAnnualIncome, bankName, bankAccountNumber, consentGiven, type
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (relationship !== undefined) data.relationship = relationship ? relationship.trim() : null;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (phone !== undefined) data.phone = phone.trim();
    if (email !== undefined) data.email = email ? email.trim() : null;
    if (address !== undefined) data.address = address ? address.trim() : null;
    if (city !== undefined) data.city = city ? city.trim() : null;
    if (pinCode !== undefined) data.pinCode = pinCode ? pinCode.trim() : null;
    if (employmentType !== undefined) data.employmentType = employmentType || null;
    if (employerName !== undefined) data.employerName = employerName ? employerName.trim() : null;
    if (grossAnnualIncome !== undefined) data.grossAnnualIncome = grossAnnualIncome ? Number(grossAnnualIncome) : null;
    if (bankName !== undefined) data.bankName = bankName ? bankName.trim() : null;
    if (type !== undefined) data.type = type;

    // Encrypt updated PII if not masked
    if (aadhar && !aadhar.includes('****')) data.aadhar = encrypt(aadhar);
    if (pan && !pan.includes('****')) data.pan = encrypt(pan);
    if (bankAccountNumber && !bankAccountNumber.includes('****')) data.bankAccountNumber = encrypt(bankAccountNumber);

    if (consentGiven !== undefined) {
      data.consentGiven = Boolean(consentGiven);
      if (consentGiven && !existing.consentGiven) data.consentDate = new Date();
    }

    const updated = await prisma.guarantor.update({
      where: { id: guarantorId },
      data
    });

    await logAudit({
      req,
      action: 'UPDATE_GUARANTOR',
      entityType: 'Guarantor',
      entityId: guarantorId,
      details: `Updated guarantor ${updated.name} on loan LN${1000 + loanId}`
    });

    res.json({ message: 'Guarantor updated', guarantor: maskGuarantor(updated) });
  } catch (error: any) {
    console.error('Update guarantor error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const deleteGuarantor = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const guarantorId = Number(req.params.guarantorId);

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const existing = await prisma.guarantor.findUnique({ where: { id: guarantorId } });
    if (!existing || existing.loanId !== loanId) {
      return res.status(404).json({ message: 'Guarantor not found' });
    }

    await prisma.guarantor.delete({ where: { id: guarantorId } });

    await logAudit({
      req,
      action: 'DELETE_GUARANTOR',
      entityType: 'Guarantor',
      entityId: guarantorId,
      details: `Removed guarantor ${existing.name} from loan LN${1000 + loanId}`
    });

    res.json({ message: 'Guarantor removed successfully' });
  } catch (error: any) {
    console.error('Delete guarantor error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const forecloseLoan = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const {
      settlementAmount,
      discount = 0,
      charges = 0,
      method = 'cash',
      reference = '',
      remarks = ''
    } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        emis: true,
        customer: true,
        company: true
      }
    });

    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status === 'completed' || loan.status === 'closed' || loan.status === 'foreclosed') {
      return res.status(400).json({ message: 'Loan is already closed or completed' });
    }

    const unpaidEmis = loan.emis.filter(e => e.status !== 'paid');
    if (unpaidEmis.length === 0) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: 'completed' }
      });
      return res.json({ message: 'Loan has zero pending balance and is already settled.', loan });
    }

    const totalUnpaidEmiAmount = unpaidEmis.reduce((s, e) => s + (e.amount - (e.paidAmount || 0)), 0);
    const totalUnpaidPenalty = unpaidEmis.reduce((s, e) => s + (e.penaltyPaid ? 0 : e.penalty || 0), 0);

    const calculatedTotal = Math.max(0, Math.round(totalUnpaidEmiAmount + totalUnpaidPenalty + Number(charges || 0) - Number(discount || 0)));
    const finalAmount = Number(settlementAmount) > 0 ? Math.round(Number(settlementAmount)) : calculatedTotal;

    const verified = method !== 'cash' && Boolean(reference);

    // Atomically clear all EMIs, record closure payment, and mark loan completed
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark every unpaid EMI as paid
      for (const emi of unpaidEmis) {
        await tx.eMI.update({
          where: { id: emi.id },
          data: {
            paidAmount: Math.round(emi.amount),
            status: 'paid',
            penaltyPaid: true
          }
        });
      }

      // 2. Record closure payment
      const payment = await tx.payment.create({
        data: {
          loanId,
          amount: finalAmount,
          method: method.toLowerCase(),
          reference: reference ? reference.trim() : `FORECLOSURE-LN${1000 + loanId}`,
          verified,
          status: 'completed',
          paidAt: new Date()
        }
      });

      // 3. Update loan status to 'completed'
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: { status: 'completed' },
        include: {
          customer: true,
          guarantors: true,
          emis: true,
          payments: true,
          company: true
        }
      });

      return { updatedLoan, payment };
    });

    await logAudit({
      req,
      action: 'FORECLOSE_LOAN',
      entityType: 'Loan',
      entityId: loanId,
      details: `Foreclosed loan LN${1000 + loanId} (${loan.customer?.name}). Settlement collected: ₹${finalAmount.toLocaleString('en-IN')} via ${method} (discount: ₹${Number(discount).toLocaleString('en-IN')}, charges: ₹${Number(charges).toLocaleString('en-IN')}). Remarks: ${remarks || 'Early closure'}`
    });

    res.json({
      message: 'Loan successfully foreclosed and marked settled',
      settlementAmount: finalAmount,
      loan: {
        ...result.updatedLoan,
        customer: maskCustomer(result.updatedLoan.customer),
        guarantors: (result.updatedLoan.guarantors || []).map(maskGuarantor)
      }
    });
  } catch (error: any) {
    console.error('Foreclose loan error:', error);
    res.status(500).json({ message: error.message || 'Server error while foreclosing loan' });
  }
};

export const triggerMidnightPenaltyJob = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const userName = req.user.name;

    const result = await runMidnightPenaltyAccrual({
      companyId,
      userId,
      userName
    });

    res.json(result);
  } catch (error: any) {
    console.error('Manual penalty job error:', error);
    res.status(500).json({ message: error.message || 'Failed to execute midnight penalty accrual', error });
  }
};




