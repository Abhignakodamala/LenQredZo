import { Router } from 'express';
import { getAllBranches, createBranch, updateBranch } from './branches.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getAllBranches);
router.post('/', protect, createBranch);
router.put('/:id', protect, updateBranch);

export default router;