import { Router } from 'express';
import {
  createLoan,
  getAllLoans,
  getLoanById,
  updateLoanStatus,
  markEmiPaid,
  getCollections,
  getPayments,
  deleteLoan,
  addGuarantorToLoan,
  updateGuarantor,
  deleteGuarantor,
  forecloseLoan
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
router.post('/', protect, requirePermission('loan:create'), createLoan);
router.put('/:id', protect, requirePermission('loan:approve'), updateLoanStatus);
router.post('/:id/foreclose', protect, requirePermission('loan:approve'), forecloseLoan);
router.put('/emi/:emiId/pay', protect, requirePermission('collection:collect'), markEmiPaid);

// Guarantor management
router.post('/:id/guarantors', protect, requirePermission('loan:create'), addGuarantorToLoan);
router.put('/:id/guarantors/:guarantorId', protect, requirePermission('loan:create'), updateGuarantor);
router.delete('/:id/guarantors/:guarantorId', protect, requirePermission('loan:create'), deleteGuarantor);

router.delete('/:id', protect, deleteLoan);
export default router;