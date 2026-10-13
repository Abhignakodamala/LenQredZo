import { Router } from 'express';
import {
  getSettings,
  updateCompany,
  uploadCompanyLogo,
  deleteCompanyLogo,
  logoUploadMiddleware,
  updateProfile,
  changePassword
} from './settings.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getSettings);
router.put('/company', protect, updateCompany);
router.post('/company/logo', protect, logoUploadMiddleware, uploadCompanyLogo);
router.delete('/company/logo', protect, deleteCompanyLogo);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

export default router;