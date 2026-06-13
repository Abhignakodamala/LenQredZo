import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login } from './auth.controller';

const router = Router();

// Limit login attempts per IP to slow down password-guessing/brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', register);
router.post('/login', loginLimiter, login);

export default router;