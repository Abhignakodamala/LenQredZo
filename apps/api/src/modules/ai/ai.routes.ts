import { Router } from 'express';
import { analyzePortfolio } from './ai.controller';
import { protect } from '../../middleware/auth';

const router = Router();

// Logged-in users only; the controller further restricts to owner/manager/accountant.
router.post('/analyze', protect, analyzePortfolio);

export default router;