import { Router } from 'express';
import { getSettings, updateCompany, updateProfile, changePassword } from './settings.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getSettings);
router.put('/company', protect, updateCompany);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

export default router;