import { Router } from 'express';
import { getAllBranches, createBranch, updateBranch } from './branches.controller';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';

const router = Router();

router.get('/', protect, getAllBranches);
router.post('/', protect, requirePermission('branch:manage'), createBranch);
router.put('/:id', protect, requirePermission('branch:manage'), updateBranch);

export default router;
