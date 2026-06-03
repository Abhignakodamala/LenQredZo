import { Router } from 'express';
import { createLoan, getAllLoans, getLoanById, updateLoanStatus, markEmiPaid } from './loans.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getAllLoans);
router.get('/:id', protect, getLoanById);
router.post('/', protect, createLoan);
router.put('/:id', protect, updateLoanStatus);
router.put('/emi/:emiId/pay', protect, markEmiPaid);

export default router;