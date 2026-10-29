import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendEmiPaymentLink,
  handleRazorpayWebhook,
  createOrder,
  verifyPayment,
  getPublicLoanPaymentDetails,
  submitPublicUpiPayment
} from './payments.controller';
import { protect } from '../../middleware/auth';
import {
  createMandate,
  getLoanMandate,
  executeMandateDebit,
  getUpcomingPreDebitEmis,
  sendPreDebitNotification,
  triggerPreDebitCron
} from './mandates.controller';
import { requirePermission } from '../../utils/permissions';

// Anti-Scraping & Anti-Brute-Force Limiters for Public Borrower UPI Portal
const publicPayViewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // Max 60 views per 15 min per IP
  message: { success: false, error: 'Too many requests. Please wait a few moments.' },
  standardHeaders: true,
  legacyHeaders: false
});

const publicUpiSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 submissions per 15 min per IP
  message: { success: false, error: 'Too many submission attempts. Please wait before retrying.' },
  standardHeaders: true,
  legacyHeaders: false
});

const router = Router();

// Public webhook route (called by Razorpay servers with cryptographic signature verification)
router.post('/webhook', handleRazorpayWebhook);

// Public Borrower 1-Tap UPI Payment Portal
router.get('/public/pay/:loanId', publicPayViewLimiter, getPublicLoanPaymentDetails);
router.post('/public/submit-upi', publicUpiSubmitLimiter, submitPublicUpiPayment);

// Protected routes (called by authenticated finance company staff)
router.post('/send-payment-link', protect, sendEmiPaymentLink);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

// UPI AutoPay & e-NACH Mandates
router.post('/mandates/create', protect, createMandate);
router.get('/mandates/:loanId', protect, getLoanMandate);
router.post('/mandates/execute-debit', protect, executeMandateDebit);

// RBI 24-Hour e-Mandate Pre-Debit Advance Notifications
router.get('/mandates/pre-debit/upcoming', protect, getUpcomingPreDebitEmis);
router.post('/mandates/pre-debit/send', protect, requirePermission('collection:collect'), sendPreDebitNotification);
router.post('/mandates/pre-debit/cron', protect, requirePermission('loan:approve'), triggerPreDebitCron);

export default router;
