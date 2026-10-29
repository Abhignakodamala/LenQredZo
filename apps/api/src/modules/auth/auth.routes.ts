import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, sendOTP, loginWithOTP, resetPassword, verifyEmailOTP, logLoginPhoto, getLoginHistory } from './auth.controller';
import { protect } from '../../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 900000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // Max 10 account creations per hour per IP
  message: { message: 'Too many account creation attempts from this IP. Please try again after 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 900000,
  max: 5,
  message: { message: 'Too many OTP requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/login-photo', protect, logLoginPhoto);
router.get('/login-history', protect, getLoginHistory);
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/login-otp', loginLimiter, loginWithOTP);
router.post('/reset-password', otpLimiter, resetPassword);
router.post('/verify-email', otpLimiter, verifyEmailOTP);

export default router;