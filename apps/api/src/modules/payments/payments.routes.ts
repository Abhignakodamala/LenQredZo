import { Router } from 'express';
import {
  sendEmiPaymentLink,
  handleRazorpayWebhook,
  createOrder,
  verifyPayment
} from './payments.controller';
import { protect } from '../../middleware/auth';
import { createMandate, getLoanMandate, executeMandateDebit } from './mandates.controller';

const router = Router();

// Public webhook route (called by Razorpay servers with cryptographic signature verification)
router.post('/webhook', handleRazorpayWebhook);

// Protected routes (called by authenticated finance company staff)
router.post('/send-payment-link', protect, sendEmiPaymentLink);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

// UPI AutoPay & e-NACH Mandates
router.post('/mandates/create', protect, createMandate);
router.get('/mandates/:loanId', protect, getLoanMandate);
router.post('/mandates/execute-debit', protect, executeMandateDebit);

export default router;
