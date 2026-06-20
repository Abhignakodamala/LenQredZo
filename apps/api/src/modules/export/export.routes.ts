import { Router } from 'express';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
import { exportCompanyData } from './export.controller';

const router = Router();

router.get('/data', protect, requirePermission('data:export'), exportCompanyData);

export default router;