import { Router } from 'express';
import {
  createLoan,
  getAllLoans,
  getLoanById,
  updateLoanStatus,
  disburseLoan,
  markEmiPaid,
  getCollections,
  getPayments,
  deleteLoan,
  addGuarantorToLoan,
  updateGuarantor,
  deleteGuarantor,
  forecloseLoan,
  triggerMidnightPenaltyJob,
  generateLegalNotice,
  getLoanLegalNotices
} from './loans.controller';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';

const router = Router();

// Viewing is open to all logged-in staff.
router.get('/', protect, getAllLoans);
router.get('/collections/all', protect, getCollections);
router.get('/payments/all', protect, getPayments);
router.get('/:id', protect, getLoanById);

// Actions are gated by permission.
router.post('/cron/accrue-penalties', protect, requirePermission('loan:approve'), triggerMidnightPenaltyJob);
router.post('/', protect, requirePermission('loan:create'), createLoan);
router.post('/:id/disburse', protect, requirePermission('loan:approve'), disburseLoan);
router.put('/:id', protect, requirePermission('loan:approve'), updateLoanStatus);
router.post('/:id/foreclose', protect, requirePermission('loan:approve'), forecloseLoan);
router.put('/emi/:emiId/pay', protect, requirePermission('collection:collect'), markEmiPaid);

// Guarantor management
router.post('/:id/guarantors', protect, requirePermission('loan:create'), addGuarantorToLoan);
router.put('/:id/guarantors/:guarantorId', protect, requirePermission('loan:create'), updateGuarantor);
router.delete('/:id/guarantors/:guarantorId', protect, requirePermission('loan:create'), deleteGuarantor);

// Legal Notices (Section 138 NI Act / Section 25 PSS Act / Recall Demand)
router.post('/:id/legal-notice', protect, generateLegalNotice);
router.get('/:id/legal-notices', protect, getLoanLegalNotices);

router.delete('/:id', protect, deleteLoan);
export default router;
