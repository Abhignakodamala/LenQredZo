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

    let mandate = null;
    const mandateAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: loan.companyId || req.user.companyId,
        entityType: 'Mandate',
        entityId: loan.id
      },
      orderBy: { createdAt: 'desc' }
    });
    if (mandateAudit && mandateAudit.details) {
      try {
        mandate = JSON.parse(mandateAudit.details);
      } catch {
        mandate = { notes: mandateAudit.details };
      }
    }

    let latestLegalNotice = null;
    const noticeAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: loan.companyId || req.user.companyId,
        entityType: 'LegalNotice',
        entityId: loan.id,
        action: 'GENERATE_LEGAL_NOTICE'
      },
      orderBy: { createdAt: 'desc' }
    });
    if (noticeAudit && noticeAudit.details) {
      try {
        latestLegalNotice = JSON.parse(noticeAudit.details);
      } catch {
        latestLegalNotice = { notes: noticeAudit.details };
      }
    }

    let latestRestructuringAddendum = null;
    const restructureAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: loan.companyId || req.user.companyId,
        entityType: 'Loan',
        entityId: loan.id,
        action: 'RESTRUCTURE_LOAN'
      },
      orderBy: { createdAt: 'desc' }
    });
    if (restructureAudit && restructureAudit.details) {
      try {
        latestRestructuringAddendum = JSON.parse(restructureAudit.details);
      } catch {
        latestRestructuringAddendum = { notes: restructureAudit.details };
      }
    }

    const safe = {
      ...loan,
      customer: maskCustomer(loan.customer),
      guarantors: (loan.guarantors || []).map(maskGuarantor),
      disbursalVoucher,
      mandate,
      latestLegalNotice,
      latestRestructuringAddendum
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

export const bulkCollectEmis = async (req: any, res: Response) => {
  try {
    const { collections, method = 'cash', reference = '', notes = '' } = req.body;
    const cleanMethod = (method || 'cash').toLowerCase();
    const cleanRef = (reference || '').trim();

    if (!Array.isArray(collections) || collections.length === 0) {
      return res.status(400).json({ success: false, message: 'No EMI items selected for collection' });
    }

    if (collections.length > 100) {
      return res.status(400).json({ success: false, message: 'Batch limit exceeded (maximum 100 collections per batch)' });
    }

    if (cleanMethod !== 'cash' && cleanRef) {
      const refCheck = validateReference(cleanMethod, cleanRef);
      if (!refCheck.ok) {
        return res.status(400).json({ success: false, message: refCheck.message });
      }
    }

    const today = new Date();
    const emiIds = collections.map((c: any) => Number(c.emiId)).filter(id => !isNaN(id) && id > 0);

    if (emiIds.length !== collections.length) {
      return res.status(400).json({ success: false, message: 'Invalid EMI ID in batch' });
    }

    // Fetch existing EMIs with loan and customer details scoped to company
    const existingEmis = await prisma.eMI.findMany({
      where: {
        id: { in: emiIds },
        loan: { companyId: req.user.companyId }
      },
      include: {
        loan: {
          include: { customer: true }
        }
      }
    });

    if (existingEmis.length !== emiIds.length) {
      return res.status(404).json({ success: false, message: 'One or more EMIs were not found or do not belong to your company' });
    }

    const emiMap = new Map<number, any>();
    for (const emi of existingEmis) {
      emiMap.set(emi.id, emi);
    }

    // Generate unique batch voucher number
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const batchVoucherNumber = `BATCH-COL-${dateStr}-${randSuffix}`;

    const processedResults = await prisma.$transaction(async (tx) => {
      const results: any[] = [];
      const affectedLoanIds = new Set<number>();

      for (const item of collections) {
        const emiId = Number(item.emiId);
        const emi = emiMap.get(emiId);
        if (!emi) continue;

        if (emi.status === 'paid') {
          throw new Error(`EMI #${emi.id} (Loan LN${1000 + emi.loanId}) has already been paid`);
        }

        const alreadyPaid = emi.paidAmount || 0;
        const remaining = emi.amount - alreadyPaid;
        const payAmount = item.amount != null ? Math.round(Number(item.amount)) : remaining;

        if (payAmount <= 0) {
          throw new Error(`Invalid payment amount for EMI #${emi.id}. Amount must be greater than 0.`);
        }
        if (payAmount > remaining) {
          throw new Error(`Amount ₹${payAmount} exceeds remaining balance of ₹${remaining} for EMI #${emi.id}`);
        }

        const newPaid = alreadyPaid + payAmount;
        const fullyCleared = newPaid >= emi.amount;
        const penaltyAmount = (fullyCleared && item.collectPenalty) ? calculatePenalty(emi, emi.loan, today) : 0;
        const paymentTotal = payAmount + penaltyAmount;

        await tx.eMI.update({
          where: { id: emiId },
          data: {
            paidAmount: newPaid,
            status: fullyCleared ? 'paid' : 'partial',
            ...(fullyCleared ? { penalty: penaltyAmount, penaltyPaid: Boolean(item.collectPenalty) } : {})
          }
        });

        await tx.payment.create({
          data: {
            loanId: emi.loanId,
            amount: paymentTotal,
            method: cleanMethod,
            reference: cleanRef || `Batch: ${batchVoucherNumber}`,
            verified: cleanMethod !== 'cash' && cleanRef.length > 0,
            status: 'completed',
            paidAt: today
          }
        });

        affectedLoanIds.add(emi.loanId);

        results.push({
          emiId: emi.id,
          loanId: emi.loanId,
          loanRef: `LN${1000 + emi.loanId}`,
          customerName: emi.loan.customer?.name || 'Borrower',
          customerPhone: emi.loan.customer?.phone || '',
          paidAmount: payAmount,
          penaltyAmount,
          totalCollected: paymentTotal,
          status: fullyCleared ? 'paid' : 'partial',
          dueDate: emi.dueDate
        });
      }

      // Check loan completion for each affected loan
      for (const loanId of affectedLoanIds) {
        const unpaidCount = await tx.eMI.count({
          where: { loanId, status: { not: 'paid' } }
        });
        if (unpaidCount === 0) {
          await tx.loan.update({
            where: { id: loanId },
            data: { status: 'completed' }
          });
        }
      }

      return results;
    });

    const totalAmountCollected = processedResults.reduce((sum, r) => sum + r.totalCollected, 0);

    // Audit log
    await logAudit({
      req,
      action: 'BULK_EMI_COLLECTION',
      entityType: 'CollectionBatch',
      entityId: 0,
      details: JSON.stringify({
        batchVoucherNumber,
        totalItems: processedResults.length,
        totalAmountCollected,
        method: cleanMethod,
        reference: cleanRef,
        notes: notes || undefined,
        collectedByUserId: req.user.userId,
        collectedByName: req.user.name,
        items: processedResults
      })
    });

    res.json({
      success: true,
      message: `Batch collection completed successfully! Received ₹${totalAmountCollected.toLocaleString('en-IN')} across ${processedResults.length} loans.`,
      batchVoucherNumber,
      totalProcessed: processedResults.length,
      totalAmountCollected,
      collectedAt: today.toISOString(),
      method: cleanMethod,
      reference: cleanRef,
      items: processedResults
    });
  } catch (error: any) {
    console.error('BULK COLLECT EMIS ERROR:', error);
    res.status(400).json({ success: false, message: error.message || 'Bulk collection transaction failed' });
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





export const generateLegalNotice = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const {
      noticeType = 'SEC_25_PSS', // 'SEC_25_PSS' | 'SEC_138_NI' | 'LOAN_RECALL'
      advocateName = 'Adv. R. V. Ramanathan, B.A., LL.B.',
      advocateBarNo = 'AP/1842/2012',
      advocateAddress = 'Chamber No. 4, District & Sessions Court Complex',
      advocatePhone = '+91 98480 22338',
      advocateEmail = 'ramanathan.advocate@courtlaw.in',
      instrumentNumber,
      dishonourDate,
      dishonourReason = 'FUNDS INSUFFICIENT / ACCOUNT INADEQUATE',
      curePeriodDays = 15,
      customRemarks = ''
    } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { customer: true, company: true, emis: { orderBy: { dueDate: 'asc' } }, guarantors: true }
    });

    if (!loan) return res.status(404).json({ success: false, error: 'Loan not found' });
    if (loan.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to loan' });
    }

    const customer = loan.customer;
    if (!customer) {
      return res.status(400).json({ success: false, error: 'Borrower customer record not found' });
    }

    // 1. Calculate overdue EMIs & amounts
    const now = new Date();
    const overdueEmis = loan.emis.filter(e => e.status !== 'paid' && new Date(e.dueDate) <= now);
    const pendingEmis = loan.emis.filter(e => e.status !== 'paid');

    const overduePrincipal = overdueEmis.reduce((s, e) => s + (e.amount - (e.paidAmount || 0)), 0);
    const totalPenalties = overdueEmis.reduce((s, e) => s + (e.penalty || 0), 0);
    const totalClaimAmount = overduePrincipal + totalPenalties;

    // 2. Generate Legal Notice Reference
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const noticeRefNo = `LN-LEGAL-${datePrefix}-LN${1000 + loan.id}-${randomSuffix}`;

    // 3. Format statutory title & subject based on noticeType
    let legalAct = '';
    let subjectLine = '';
    let primaryStatute = '';

    if (noticeType === 'SEC_138_NI') {
      legalAct = 'Negotiable Instruments Act, 1881';
      primaryStatute = 'Section 138 of the Negotiable Instruments Act, 1881 read with Section 420 of the Indian Penal Code, 1860';
      subjectLine = `STATUTORY LEGAL DEMAND NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 FOR DISHONOUR OF CHEQUE NO. ${instrumentNumber || 'PDC'} FOR ₹${overduePrincipal.toLocaleString('en-IN')}`;
    } else if (noticeType === 'SEC_25_PSS') {
      legalAct = 'Payment and Settlement Systems Act, 2007';
      primaryStatute = 'Section 25 of the Payment and Settlement Systems Act, 2007 read with Section 420 of the Indian Penal Code, 1860';
      subjectLine = `STATUTORY LEGAL DEMAND NOTICE UNDER SECTION 25 OF THE PAYMENT AND SETTLEMENT SYSTEMS ACT, 2007 FOR DISHONOUR OF ELECTRONIC MANDATE / e-NACH (UMN: ${instrumentNumber || 'NPCI-MANDATE'}) FOR ₹${overduePrincipal.toLocaleString('en-IN')}`;
    } else {
      legalAct = 'Indian Contract Act, 1872';
      primaryStatute = 'Section 73 & 74 of the Indian Contract Act, 1872 and Specific Relief Act';
      subjectLine = `LEGAL RECALL & FINAL DEMAND NOTICE FOR ACCELERATED REPAYMENT OF DEFAULTED LOAN LN${1000 + loan.id} OF ₹${totalClaimAmount.toLocaleString('en-IN')}`;
    }

    const noticePayload = {
      noticeRefNo,
      noticeType,
      legalAct,
      primaryStatute,
      subjectLine,
      issuedAt: now.toISOString(),
      curePeriodDays,
      cureDeadline: new Date(now.getTime() + curePeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      advocate: {
        name: advocateName,
        barEnrollmentNo: advocateBarNo,
        address: advocateAddress,
        phone: advocatePhone,
        email: advocateEmail
      },
      client: {
        companyId: loan.company?.id,
        companyName: loan.company?.name || 'LenQredzo Capital Private Limited',
        companyEmail: (loan.company as any)?.email,
        companyPhone: (loan.company as any)?.phone
      },
      borrower: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        pan: customer.pan ? maskPan(safeDecrypt(customer.pan)) : '—',
        aadhar: customer.aadhar ? maskAadhaar(safeDecrypt(customer.aadhar)) : '—',
        address: [customer.street, customer.city, customer.address].filter(Boolean).join(', ') || 'Address on record'
      },
      guarantors: (loan.guarantors || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        phone: g.phone,
        relationship: g.relationship,
        address: g.address || 'Address on record'
      })),
      loanDetails: {
        loanId: loan.id,
        loanRef: `LN${1000 + loan.id}`,
        loanType: loan.type,
        sanctionDate: loan.createdAt,
        sanctionAmount: loan.amount,
        tenure: loan.tenure,
        frequency: loan.frequency,
        emiAmount: loan.emis?.[0]?.amount || (loan as any).emiAmount || 0
      },
      defaultDetails: {
        overdueEmisCount: overdueEmis.length,
        pendingEmisCount: pendingEmis.length,
        overduePrincipal,
        totalPenalties,
        totalClaimAmount,
        instrumentNumber: instrumentNumber || (noticeType === 'SEC_138_NI' ? 'CHEQUE-PDC' : 'NPCI-eNACH'),
        dishonourDate: dishonourDate || now.toISOString().slice(0, 10),
        dishonourReason
      },
      overdueEmisList: overdueEmis.map(e => ({
        id: e.id,
        dueDate: e.dueDate,
        amount: e.amount,
        penalty: e.penalty || 0,
        totalDue: e.amount + (e.penalty || 0)
      })),
      customRemarks,
      issuedByUserId: req.user.userId,
      issuedByName: req.user.name || 'Legal Operations Officer'
    };

    // Store in AuditLog for permanent tamper-proof legal record
    await logAudit({
      req,
      action: 'GENERATE_LEGAL_NOTICE',
      entityType: 'LegalNotice',
      entityId: loan.id,
      details: JSON.stringify(noticePayload)
    });

    res.json({
      success: true,
      message: `Statutory Legal Demand Notice ${noticeRefNo} generated successfully!`,
      notice: noticePayload
    });
  } catch (error: any) {
    console.error('Generate legal notice error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate legal notice' });
  }
};

export const getLoanLegalNotices = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const notices = await prisma.auditLog.findMany({
      where: {
        companyId: req.user.companyId,
        entityType: 'LegalNotice',
        entityId: loanId,
        action: 'GENERATE_LEGAL_NOTICE'
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = notices.map(n => {
      try {
        return JSON.parse(n.details || '{}');
      } catch {
        return { noticeRefNo: `NOTICE-${n.id}`, notes: n.details };
      }
    });

    res.json({ success: true, notices: parsed });
  } catch (error: any) {
    console.error('Get loan legal notices error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch legal notices' });
  }
};


export const restructureLoan = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const {
      restructuringType = 'moratorium',
      moratoriumMonths = 0,
      additionalInstallments = 0,
      newInterestRate,
      capitalizePenalty = false,
      waivePenalty = false,
      reason = '',
      revisedStartDate,
      officerNotes = ''
    } = req.body;

    if (!reason.trim()) {
      return res.status(400).json({ success: false, message: 'A verified reason/justification is required for loan restructuring (e.g. medical distress, business disruption, natural calamity).' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        customer: true,
        company: true,
        emis: { orderBy: { dueDate: 'asc' } },
        guarantors: true
      }
    });

    if (!loan || loan.companyId !== req.user.companyId) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    if (loan.status === 'completed' || loan.status === 'rejected' || loan.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Cannot restructure a loan in '${loan.status}' status.` });
    }

    const clearedEmis = loan.emis.filter(e => e.status === 'paid');
    const unpaidEmis = loan.emis.filter(e => e.status !== 'paid');

    if (unpaidEmis.length === 0) {
      return res.status(400).json({ success: false, message: 'All EMIs for this loan are already fully paid. Nothing to restructure.' });
    }

    const outstandingBalance = unpaidEmis.reduce((sum, e) => sum + (e.amount - (e.paidAmount || 0)), 0);
    const totalPenalties = unpaidEmis.reduce((sum, e) => sum + (e.penalty || 0), 0);
    const capitalizedPenaltyAmount = (!waivePenalty && capitalizePenalty) ? totalPenalties : 0;
    const waivedPenaltyAmount = waivePenalty ? totalPenalties : 0;
    const newRestructuredPrincipal = outstandingBalance + capitalizedPenaltyAmount;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const addendumRefNo = `RES-ADDENDUM-${dateStr}-${randSuffix}`;

    const numMoratorium = Math.max(0, Number(moratoriumMonths) || 0);
    const numAdditional = Math.max(0, Number(additionalInstallments) || 0);

    let baseStartDate = revisedStartDate ? new Date(revisedStartDate) : new Date();
    if (isNaN(baseStartDate.getTime())) baseStartDate = new Date();

    if (numMoratorium > 0) {
      baseStartDate.setMonth(baseStartDate.getMonth() + numMoratorium);
    }

    let updatedLoan: any = null;
    let oldEmiAmount = loan.emis[0]?.amount || 0;
    let revisedEmiAmount = oldEmiAmount;

    await prisma.$transaction(async (tx) => {
      if (restructuringType === 'moratorium') {
        for (let i = 0; i < unpaidEmis.length; i++) {
          const emi = unpaidEmis[i];
          const currentDue = new Date(emi.dueDate);
          const newDue = new Date(currentDue);
          newDue.setMonth(newDue.getMonth() + numMoratorium);

          await tx.eMI.update({
            where: { id: emi.id },
            data: {
              dueDate: newDue,
              status: emi.paidAmount > 0 ? 'partial' : 'pending',
              ...(waivePenalty || capitalizePenalty ? { penalty: 0 } : {})
            }
          });
        }
      } else {
        const newRemainingCount = unpaidEmis.length + numAdditional;
        if (newRemainingCount <= 0) {
          throw new Error('New tenure must be at least 1 installment.');
        }

        revisedEmiAmount = Math.round(newRestructuredPrincipal / newRemainingCount);

        await tx.eMI.deleteMany({
          where: {
            loanId: loan.id,
            status: { not: 'paid' }
          }
        });

        const emisToInsert: any[] = [];
        for (let i = 1; i <= newRemainingCount; i++) {
          const dueDate = getNextDueDate(baseStartDate, i, loan.frequency);
          emisToInsert.push({
            loanId: loan.id,
            amount: revisedEmiAmount,
            dueDate,
            status: 'pending',
            penalty: 0,
            penaltyPaid: false,
            paidAmount: 0
          });
        }
        await tx.eMI.createMany({ data: emisToInsert });

        const totalNewTenure = clearedEmis.length + newRemainingCount;
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            tenure: totalNewTenure,
            status: 'active',
            ...(newInterestRate ? { interestRate: Number(newInterestRate) } : {})
          }
        });
      }

      updatedLoan = await tx.loan.findUnique({
        where: { id: loan.id },
        include: { emis: { orderBy: { dueDate: 'asc' } } }
      });
    });

    const addendumPayload = {
      addendumRefNo,
      loanId: loan.id,
      loanRef: `LN${1000 + loan.id}`,
      restructuringDate: today.toISOString(),
      restructuringType,
      reason: reason.trim(),
      officerNotes: officerNotes.trim() || undefined,
      borrower: {
        id: loan.customer.id,
        name: loan.customer.name,
        phone: loan.customer.phone,
        pan: loan.customer.pan ? maskPan(safeDecrypt(loan.customer.pan)) : '—',
        aadhar: loan.customer.aadhar ? maskAadhaar(safeDecrypt(loan.customer.aadhar)) : '—'
      },
      company: {
        id: loan.company?.id,
        name: loan.company?.name || 'LenQredzo Capital Private Limited'
      },
      originalTerms: {
        sanctionAmount: loan.amount,
        originalTenure: loan.tenure,
        frequency: loan.frequency,
        originalEmiAmount: oldEmiAmount,
        clearedInstallments: clearedEmis.length,
        totalPaidSoFar: clearedEmis.reduce((sum, e) => sum + e.amount, 0)
      },
      restructuredTerms: {
        outstandingBalanceAtRestructure: outstandingBalance,
        penaltiesCapitalized: capitalizedPenaltyAmount,
        penaltiesWaived: waivedPenaltyAmount,
        newPrincipal: newRestructuredPrincipal,
        moratoriumMonths: numMoratorium,
        additionalInstallments: numAdditional,
        newRemainingInstallments: updatedLoan.emis.filter((e: any) => e.status !== 'paid').length,
        totalNewTenure: updatedLoan.tenure,
        revisedEmiAmount,
        resumptionDate: baseStartDate.toISOString().slice(0, 10),
        newMaturityDate: updatedLoan.emis[updatedLoan.emis.length - 1]?.dueDate
      },
      authorizedOfficer: {
        userId: req.user.userId,
        name: req.user.name || 'Branch Credit Head',
        role: req.user.role
      }
    };

    await logAudit({
      req,
      action: 'RESTRUCTURE_LOAN',
      entityType: 'Loan',
      entityId: loan.id,
      details: JSON.stringify(addendumPayload)
    });

    res.json({
      success: true,
      message: `Loan LN${1000 + loan.id} restructured successfully under ${addendumRefNo}!`,
      addendum: addendumPayload,
      loan: updatedLoan
    });
  } catch (error: any) {
    console.error('RESTRUCTURE LOAN ERROR:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to restructure loan' });
  }
};

export const getLoanRestructuringAddenda = async (req: any, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: req.user.companyId,
        entityType: 'Loan',
        entityId: loanId,
        action: 'RESTRUCTURE_LOAN'
      },
      orderBy: { createdAt: 'desc' }
    });

    const addenda = audits.map(a => {
      try {
        return JSON.parse(a.details || '{}');
      } catch {
        return { addendumRefNo: `ADDENDUM-${a.id}`, notes: a.details };
      }
    });

    res.json({ success: true, addenda });
  } catch (error: any) {
    console.error('Get restructuring addenda error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch restructuring addenda' });
  }
};



export const getNpaAgeingMatrix = async (req: any, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const loans = await prisma.loan.findMany({
      where: loanScope(req.user),
      include: {
        customer: true,
        company: true,
        emis: { orderBy: { dueDate: 'asc' } }
      }
    });

    const standardLoans: any[] = [];
    const sma0Loans: any[] = [];
    const sma1Loans: any[] = [];
    const sma2Loans: any[] = [];
    const npaLoans: any[] = [];

    let totalAum = 0;
    let totalOverdue = 0;
    let totalProvisionReserve = 0;

    for (const loan of loans) {
      if (loan.status === 'completed' || loan.status === 'cancelled' || loan.status === 'rejected') {
        continue;
      }

      const unpaidEmis = loan.emis.filter((e: any) => e.status !== 'paid');
      if (unpaidEmis.length === 0) continue;

      const outstandingPrincipal = unpaidEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0);
      const totalPenalties = unpaidEmis.reduce((s: number, e: any) => s + (e.penalty || 0), 0);
      const overdueEmis = unpaidEmis.filter((e: any) => new Date(e.dueDate) < today);

      let dpd = 0;
      if (overdueEmis.length > 0) {
        const oldestDue = new Date(overdueEmis[0].dueDate);
        dpd = Math.max(0, Math.floor((today.getTime() - oldestDue.getTime()) / 86400000));
      }

      totalAum += outstandingPrincipal;
      const overdueAmount = overdueEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0) + totalPenalties;
      totalOverdue += overdueAmount;

      let bucket = 'Standard';
      let provisionRate = 0.4;

      if (dpd === 0) {
        bucket = 'Standard';
        provisionRate = 0.4;
      } else if (dpd <= 30) {
        bucket = 'SMA-0';
        provisionRate = 0.4;
      } else if (dpd <= 60) {
        bucket = 'SMA-1';
        provisionRate = 5.0;
      } else if (dpd <= 90) {
        bucket = 'SMA-2';
        provisionRate = 10.0;
      } else {
        bucket = 'NPA';
        provisionRate = 15.0;
      }

      const provisionAmount = Math.round(outstandingPrincipal * (provisionRate / 100));
      totalProvisionReserve += provisionAmount;

      const customer: any = loan.customer || {};
      const item = {
        loanId: loan.id,
        loanRef: `LN${1000 + loan.id}`,
        customerId: customer.id,
        customerName: customer.name || 'Borrower',
        customerPhone: customer.phone || '',
        customerCity: customer.city || '—',
        loanType: loan.type,
        sanctionAmount: loan.amount,
        outstandingPrincipal,
        overdueAmount,
        dpd,
        bucket,
        provisionRate,
        provisionAmount,
        overdueEmisCount: overdueEmis.length,
        totalUnpaidEmis: unpaidEmis.length,
        oldestDueDate: overdueEmis[0]?.dueDate || null,
        interestRate: loan.interestRate
      };

      if (bucket === 'Standard') standardLoans.push(item);
      else if (bucket === 'SMA-0') sma0Loans.push(item);
      else if (bucket === 'SMA-1') sma1Loans.push(item);
      else if (bucket === 'SMA-2') sma2Loans.push(item);
      else npaLoans.push(item);
    }

    const calcSum = (arr: any[]) => arr.reduce((s, i) => s + i.outstandingPrincipal, 0);

    const standardSum = calcSum(standardLoans);
    const sma0Sum = calcSum(sma0Loans);
    const sma1Sum = calcSum(sma1Loans);
    const sma2Sum = calcSum(sma2Loans);
    const npaSum = calcSum(npaLoans);

    const par30Amount = sma1Sum + sma2Sum + npaSum;
    const par60Amount = sma2Sum + npaSum;

    const par30Ratio = totalAum > 0 ? Number(((par30Amount / totalAum) * 100).toFixed(2)) : 0;
    const par60Ratio = totalAum > 0 ? Number(((par60Amount / totalAum) * 100).toFixed(2)) : 0;
    const grossNpaRatio = totalAum > 0 ? Number(((npaSum / totalAum) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      summary: {
        totalAum,
        totalOverdue,
        totalProvisionReserve,
        par30Amount,
        par30Ratio,
        par60Amount,
        par60Ratio,
        grossNpaAmount: npaSum,
        grossNpaRatio,
        asOfDate: today.toISOString().slice(0, 10),
        totalActiveLoans: standardLoans.length + sma0Loans.length + sma1Loans.length + sma2Loans.length + npaLoans.length
      },
      buckets: {
        standard: { label: 'Standard (0 DPD)', count: standardLoans.length, amount: standardSum, provisionRate: '0.40%', color: '#16a34a', items: standardLoans },
        sma0: { label: 'SMA-0 (1–30 DPD)', count: sma0Loans.length, amount: sma0Sum, provisionRate: '0.40%', color: '#eab308', items: sma0Loans },
        sma1: { label: 'SMA-1 (31–60 DPD)', count: sma1Loans.length, amount: sma1Sum, provisionRate: '5.00%', color: '#f97316', items: sma1Loans },
        sma2: { label: 'SMA-2 (61–90 DPD)', count: sma2Loans.length, amount: sma2Sum, provisionRate: '10.00%', color: '#ef4444', items: sma2Loans },
        npa: { label: 'NPA (>90 DPD)', count: npaLoans.length, amount: npaSum, provisionRate: '15.00%', color: '#991b1b', items: npaLoans }
      }
    });
  } catch (error: any) {
    console.error('NPA Ageing Matrix Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to compute NPA Ageing Matrix' });
  }
};

export const exportCreditBureauData = async (req: any, res: Response) => {
  try {
    const { format = 'csv', bureau = 'cibil', month } = req.query;
    const today = new Date();
    const reportingMonth = (typeof month === 'string' && month) ? month : today.toISOString().slice(0, 7);
    const dateStamp = today.toISOString().slice(0, 10).replace(/-/g, '');

    const loans = await prisma.loan.findMany({
      where: loanScope(req.user),
      include: {
        customer: true,
        company: true,
        emis: { orderBy: { dueDate: 'asc' } }
      }
    });

    const companyName = req.user.companyName || 'LenQredzo Capital Private Limited';
    const memberId = 'IN' + String(req.user.companyId || 1000).padStart(6, '0');

    const records = [];
    let totalCurrentBalance = 0;
    let totalOverdue = 0;

    for (const loan of loans) {
      if (loan.status === 'cancelled' || loan.status === 'rejected') continue;

      const customer: any = loan.customer || {};
      const unpaidEmis = loan.emis.filter((e: any) => e.status !== 'paid');
      const outstandingBalance = unpaidEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0);
      const overdueEmis = unpaidEmis.filter((e: any) => new Date(e.dueDate) < today);

      let dpd = 0;
      if (overdueEmis.length > 0) {
        const oldestDue = new Date(overdueEmis[0].dueDate);
        dpd = Math.max(0, Math.floor((today.getTime() - oldestDue.getTime()) / 86400000));
      }

      const overdueAmount = overdueEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0);
      totalCurrentBalance += outstandingBalance;
      totalOverdue += overdueAmount;

      const dpdFormatted = String(Math.min(900, dpd)).padStart(3, '0');

      let assetClass = '01';
      if (dpd > 90 && dpd <= 365) assetClass = '02';
      else if (dpd > 365 && dpd <= 730) assetClass = '03';
      else if (dpd > 730) assetClass = '04';

      const panDecrypted = safeDecrypt(customer.pan);
      const aadharDecrypted = safeDecrypt(customer.aadhar);

      let accountTypeCode = '05';
      const lType = (loan.type || '').toLowerCase();
      if (lType.includes('home') || lType.includes('mortgage') || lType.includes('property')) accountTypeCode = '02';
      else if (lType.includes('vehicle') || lType.includes('auto') || lType.includes('car')) accountTypeCode = '01';
      else if (lType.includes('business') || lType.includes('commercial')) accountTypeCode = '08';
      else if (lType.includes('micro') || lType.includes('group')) accountTypeCode = '51';

      records.push({
        memberId,
        memberShortName: companyName.slice(0, 16).toUpperCase(),
        reportingMonth,
        accountNumber: `LN${1000 + loan.id}`,
        accountType: accountTypeCode,
        ownershipIndicator: '1',
        borrowerName: (customer.name || 'Borrower').toUpperCase(),
        dob: customer.dob ? new Date(customer.dob).toISOString().slice(0, 10).replace(/-/g, '') : '19850101',
        gender: (customer.gender || 'M').toUpperCase().slice(0, 1),
        incomeTaxPan: panDecrypted ? panDecrypted.toUpperCase() : 'PANNOTAVBL',
        aadhaarNumber: aadharDecrypted ? aadharDecrypted.replace(/\D/g, '').slice(-12) : '',
        mobileNumber: customer.phone ? customer.phone.replace(/\D/g, '').slice(-10) : '9999999999',
        address1: (customer.street || customer.address || 'Address Line 1').replace(/,/g, ' '),
        address2: (customer.city || 'City').replace(/,/g, ' '),
        city: customer.city || 'City',
        state: customer.state || 'Telangana',
        pinCode: customer.pincode || '500001',
        openDate: loan.createdAt ? new Date(loan.createdAt).toISOString().slice(0, 10).replace(/-/g, '') : dateStamp,
        sanctionAmount: Math.round(loan.amount),
        currentBalance: Math.round(outstandingBalance),
        amountOverdue: Math.round(overdueAmount),
        dpd: dpdFormatted,
        assetClassification: assetClass,
        repaymentFrequency: loan.frequency === 'daily' ? '01' : loan.frequency === 'weekly' ? '02' : '03',
        actualPaymentAmount: Math.round(loan.emis.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + e.amount, 0)),
        repaymentTenure: loan.tenure || 12,
        emiAmount: Math.round(loan.emis[0]?.amount || 0),
        status: loan.status === 'completed' ? 'CLOSED' : 'ACTIVE'
      });
    }

    await logAudit({
      req,
      action: 'EXPORT_CREDIT_BUREAU_DATA',
      entityType: 'CreditBureau',
      entityId: 0,
      details: JSON.stringify({
        bureau: String(bureau).toUpperCase(),
        format,
        reportingMonth,
        totalAccounts: records.length,
        totalCurrentBalance,
        totalOverdue,
        exportedAt: today.toISOString()
      })
    });

    if (format === 'tudf') {
      let tudfContent = `TUDFFILE|${memberId}|${companyName}|${dateStamp}|${records.length}\n`;
      for (const r of records) {
        tudfContent += `ACC|${r.accountNumber}|${r.accountType}|${r.ownershipIndicator}|${r.openDate}|${r.sanctionAmount}|${r.currentBalance}|${r.amountOverdue}|${r.dpd}|${r.assetClassification}|${r.emiAmount}|${r.repaymentTenure}\n`;
        tudfContent += `NAM|${r.borrowerName}|${r.dob}|${r.gender}|${r.incomeTaxPan}|${r.aadhaarNumber}\n`;
        tudfContent += `ADD|${r.address1}|${r.address2}|${r.city}|${r.state}|${r.pinCode}|${r.mobileNumber}\n`;
      }
      tudfContent += `TRL|${records.length}|${totalCurrentBalance}|${totalOverdue}\n`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${String(bureau).toUpperCase()}_TUDF_${reportingMonth.replace('-', '')}.txt"`);
      return res.send(tudfContent);
    }

    const headers = [
      'Reporting_Member_ID', 'Member_Name', 'Reporting_Month', 'Account_Number',
      'Account_Type_Code', 'Ownership_Indicator', 'Borrower_Name', 'Date_Of_Birth',
      'Gender', 'Income_Tax_PAN', 'Aadhaar_Number', 'Mobile_Number',
      'Address_Line_1', 'Address_Line_2', 'City', 'State', 'PIN_Code',
      'Date_Opened_Sanctioned', 'Sanctioned_Amount', 'Current_Balance',
      'Amount_Overdue', 'Days_Past_Due_DPD', 'Asset_Classification',
      'Repayment_Frequency', 'Tenure_Months', 'EMI_Amount', 'Loan_Status'
    ];

    const rows = records.map(r => [
      `"${r.memberId}"`, `"${r.memberShortName}"`, `"${r.reportingMonth}"`, `"${r.accountNumber}"`,
      `"${r.accountType}"`, `"${r.ownershipIndicator}"`, `"${r.borrowerName}"`, `"${r.dob}"`,
      `"${r.gender}"`, `"${r.incomeTaxPan}"`, `"${r.aadhaarNumber}"`, `"${r.mobileNumber}"`,
      `"${r.address1}"`, `"${r.address2}"`, `"${r.city}"`, `"${r.state}"`, `"${r.pinCode}"`,
      `"${r.openDate}"`, r.sanctionAmount, r.currentBalance,
      r.amountOverdue, `"${r.dpd}"`, `"${r.assetClassification}"`,
      `"${r.repaymentFrequency}"`, r.repaymentTenure, r.emiAmount, `"${r.status}"`
    ].join(','));

    const csvContent = headers.join(',') + '\n' + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${String(bureau).toUpperCase()}_BUREAU_DATA_${reportingMonth.replace('-', '')}.csv"`);
    return res.send(csvContent);
  } catch (error: any) {
    console.error('Export Credit Bureau Data Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to export bureau data' });
  }
};
