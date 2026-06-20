import { Router } from 'express';
import { getStaff, createStaff, updateStaff } from './staff.controller';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';

const router = Router();

// Only roles with 'staff:manage' (owner / Super Admin) can manage staff.
router.get('/', protect, requirePermission('staff:manage'), getStaff);
router.post('/', protect, requirePermission('staff:manage'), createStaff);
router.put('/:id', protect, requirePermission('staff:manage'), updateStaff);

export default router;