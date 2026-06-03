import { Router } from 'express';
import { createLoan, getAllLoans, getLoanById, updateLoanStatus } from './loans.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getAllLoans);
router.get('/:id', protect, getLoanById);
router.post('/', protect, createLoan);
router.put('/:id', protect, updateLoanStatus);

export default router;
