import { Router } from 'express';
import { protect } from '../../middleware/auth';
import {
  getCashRegisterSummary,
  initiateCashHandover,
  acceptCashHandover,
  getHandoverHistory
} from './cash-register.controller';

const router = Router();

// Staff and Manager cash register routes
router.get('/summary', protect, getCashRegisterSummary);
router.post('/handover/initiate', protect, initiateCashHandover);
router.post('/handover/accept', protect, acceptCashHandover);
router.get('/handovers/history', protect, getHandoverHistory);

export default router;
