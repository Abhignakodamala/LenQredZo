import { Router } from 'express';
import { createLoan, getAllLoans, getLoanById, updateLoanStatus, markEmiPaid, getCollections, getPayments, deleteLoan } from './loans.controller';
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
router.put('/emi/:emiId/pay', protect, requirePermission('collection:collect'), markEmiPaid);

router.delete('/:id', protect, deleteLoan);
export default router;