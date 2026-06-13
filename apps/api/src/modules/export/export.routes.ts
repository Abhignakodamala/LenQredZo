import { Router } from 'express';
import { protect } from '../../middleware/auth';
import { exportCompanyData } from './export.controller';

const router = Router();

router.get('/data', protect, exportCompanyData);

export default router;