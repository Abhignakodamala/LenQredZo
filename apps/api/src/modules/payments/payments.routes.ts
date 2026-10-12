import { Router } from 'express';
import {
  sendEmiPaymentLink,
  handleRazorpayWebhook,
  createOrder,
  verifyPayment
} from './payments.controller';
import { protect } from '../../middleware/auth';

const router = Router();

// Public webhook route (called by Razorpay servers with cryptographic signature verification)
router.post('/webhook', handleRazorpayWebhook);

// Protected routes (called by authenticated finance company staff)
router.post('/send-payment-link', protect, sendEmiPaymentLink);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

export default router;
