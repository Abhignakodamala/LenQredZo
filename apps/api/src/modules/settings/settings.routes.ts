import { Router } from 'express';
import {
  getSettings,
  updateCompany,
  uploadCompanyLogo,
  deleteCompanyLogo,
  logoUploadMiddleware,
  updateProfile,
  changePassword,
  getRazorpaySettings,
  updateRazorpaySettings,
  testRazorpayConnection
} from './settings.controller';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';

const router = Router();

// Profile & personal password (accessible by all authenticated staff)
router.get('/', protect, getSettings);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

// Company branding & configuration (restricted to Owner / Super Admin)
router.put('/company', protect, requirePermission('settings:manage'), updateCompany);
router.post('/company/logo', protect, requirePermission('settings:manage'), logoUploadMiddleware, uploadCompanyLogo);
router.delete('/company/logo', protect, requirePermission('settings:manage'), deleteCompanyLogo);

// Razorpay & Connected Banking Credentials (restricted to Owner / Super Admin)
router.get('/razorpay', protect, requirePermission('settings:manage'), getRazorpaySettings);
router.put('/razorpay', protect, requirePermission('settings:manage'), updateRazorpaySettings);
router.post('/razorpay/test', protect, requirePermission('settings:manage'), testRazorpayConnection);

export default router;
