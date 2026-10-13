import prisma from '../lib/prisma';

export interface AccrualOptions {
  companyId?: number;
  userId?: number;
  userName?: string;
}

export interface AccrualResult {
  success: boolean;
  runAt: string;
  totalLoansChecked: number;
  overdueEmisCount: number;
  totalPenaltyAccrued: number;
  updatedRecords: Array<{
    emiId: number;
    loanId: number;
    loanRef: string;
    customerName: string;
    customerPhone: string;
    dueDate: string;
    daysOverdue: number;
    penaltyType: string;
    penaltyValue: number;
    previousPenalty: number;
    newPenalty: number;
    penaltyAccruedThisRun: number;
  }>;
}

/**
 * Scans active loans, marks overdue EMIs as 'overdue',
 * and calculates late payment penalty fees based on loan policy.
 */
export async function runMidnightPenaltyAccrual(options?: AccrualOptions): Promise<AccrualResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const loanWhere: any = {
    status: 'active'
  };

  if (options?.companyId) {
    loanWhere.companyId = options.companyId;
  }

  const activeLoans = await prisma.loan.findMany({
    where: loanWhere,
    include: {
      customer: true,
      emis: {
        where: {
          status: { in: ['pending', 'partial', 'overdue'] }
        },
        orderBy: { dueDate: 'asc' }
      }
    }
  });

  let overdueUpdatedCount = 0;
  let totalPenaltyAccrued = 0;
  const updatedRecords: AccrualResult['updatedRecords'] = [];

  for (const loan of activeLoans) {
    for (const emi of loan.emis) {
      const emiDueDate = new Date(emi.dueDate);
      emiDueDate.setHours(0, 0, 0, 0);

      // Check if due date has passed
      if (emiDueDate < today) {
        const diffTime = today.getTime() - emiDueDate.getTime();
        const daysOverdue = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        let calculatedPenalty = 0;
        if (loan.penaltyType === 'fixed') {
          calculatedPenalty = Number(loan.penaltyValue || 0);
        } else if (loan.penaltyType === 'percentage') {
          calculatedPenalty = Math.round((Number(emi.amount) * Number(loan.penaltyValue || 0)) / 100);
        } else if (loan.penaltyType === 'daily') {
          calculatedPenalty = Math.round(daysOverdue * Number(loan.penaltyValue || 0));
        }

        const needsStatusUpdate = emi.status !== 'overdue';
        const oldPenalty = Number(emi.penalty || 0);
        const penaltyDiff = calculatedPenalty - oldPenalty;

        if (needsStatusUpdate || penaltyDiff > 0) {
          await prisma.eMI.update({
            where: { id: emi.id },
            data: {
              status: 'overdue',
              penalty: Math.max(oldPenalty, calculatedPenalty)
            }
          });

          if (needsStatusUpdate) overdueUpdatedCount++;
          if (penaltyDiff > 0) totalPenaltyAccrued += penaltyDiff;

          updatedRecords.push({
            emiId: emi.id,
            loanId: loan.id,
            loanRef: `LN${1000 + loan.id}`,
            customerName: loan.customer?.name || 'Unknown',
            customerPhone: loan.customer?.phone || '',
            dueDate: emi.dueDate.toISOString(),
            daysOverdue,
            penaltyType: loan.penaltyType,
            penaltyValue: Number(loan.penaltyValue || 0),
            previousPenalty: oldPenalty,
            newPenalty: Math.max(oldPenalty, calculatedPenalty),
            penaltyAccruedThisRun: Math.max(0, penaltyDiff)
          });
        }
      }
    }
  }

  // Create audit log entry if triggered for a company
  if (options?.companyId) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId: options.companyId,
          userId: options.userId || null,
          userName: options.userName || 'SYSTEM CRON',
          action: 'CRON_PENALTY_ACCRUAL',
          entityType: 'EMI',
          entityId: null,
          details: `Midnight Penalty Accrual: Scanned ${activeLoans.length} loans, updated ${overdueUpdatedCount} overdue EMIs, accrued ₹${totalPenaltyAccrued.toLocaleString('en-IN')} in late fees.`
        }
      });
    } catch (auditErr) {
      console.error('Audit log error in penalty accrual:', auditErr);
    }
  }

  return {
    success: true,
    runAt: new Date().toISOString(),
    totalLoansChecked: activeLoans.length,
    overdueEmisCount: overdueUpdatedCount,
    totalPenaltyAccrued,
    updatedRecords
  };
}

let lastRunDateIST = '';

/**
 * Initializes the automated midnight background timer.
 * Checks hourly and triggers automatically when IST date transitions at 00:00.
 */
export function startMidnightCronScheduler() {
  console.log('⏰ [Cron Scheduler] Initializing Automated Midnight Penalty & Overdue Accrual...');

  // Run a check every 30 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      // Calculate IST time (UTC + 5:30)
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const istDateStr = istTime.toISOString().split('T')[0];
      const istHours = istTime.getUTCHours();

      // If it's the midnight hour (00:00 - 00:59 IST) and has not run for today's IST date yet:
      if (istHours === 0 && lastRunDateIST !== istDateStr) {
        lastRunDateIST = istDateStr;
        console.log(`🌙 [Cron Scheduler] Running automated midnight penalty accrual for IST Date: ${istDateStr}`);
        const result = await runMidnightPenaltyAccrual();
        console.log(`✅ [Cron Scheduler] Accrual finished: ${result.overdueEmisCount} EMIs updated, ₹${result.totalPenaltyAccrued} penalties accrued across ${result.totalLoansChecked} loans.`);
      }
    } catch (err) {
      console.error('❌ [Cron Scheduler] Error during automated midnight penalty check:', err);
    }
  }, 30 * 60 * 1000); // Check every 30 minutes
}

// Automatically start scheduler on server load
startMidnightCronScheduler();

