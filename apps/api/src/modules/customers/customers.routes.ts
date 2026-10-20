import { Router } from 'express';

import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
import { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, bulkImportCustomers } from './customers.controller';
import {
  uploadMiddleware,
  uploadDocument,
  getCustomerDocuments,
  verifyCustomerDocument,
  deleteCustomerDocument,
  updateCustomerKycStatus
} from './documents.controller';
import {
  verifyCustomerBankAccount,
  generateUpiVerificationQr,
  verifyUpiPayment,
  updateCustomerBankDetails
} from './bank.controller';

const router = Router();

// Viewing is open to all logged-in staff.
router.get('/', protect, getAllCustomers);
router.get('/:id', protect, getCustomerById);
router.get('/:id/documents', protect, getCustomerDocuments);

// Document upload & KYC actions
router.post('/:id/documents', protect, requirePermission('customer:edit'), (req, res, next) => {
  uploadMiddleware(req as any, res as any, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    uploadDocument(req, res);
  });
});
router.patch('/:id/documents/:docId/verify', protect, requirePermission('customer:edit'), verifyCustomerDocument);
router.delete('/:id/documents/:docId', protect, requirePermission('customer:edit'), deleteCustomerDocument);
router.patch('/:id/kyc-status', protect, requirePermission('customer:edit'), updateCustomerKycStatus);

// Dual-Method Bank Account Verification (₹1 UPI QR Scan & Bank Account + IFSC Penny Drop)
router.post('/:id/verify-bank', protect, requirePermission('customer:edit'), verifyCustomerBankAccount);
router.post('/:id/verify-upi-qr', protect, requirePermission('customer:edit'), generateUpiVerificationQr);
router.post('/:id/verify-upi', protect, requirePermission('customer:edit'), verifyUpiPayment);
router.put('/:id/bank-details', protect, requirePermission('customer:edit'), updateCustomerBankDetails);

router.post('/bulk-import', protect, bulkImportCustomers);
// Actions are gated by permission.
router.post('/', protect, requirePermission('customer:create'), createCustomer);
router.put('/:id', protect, requirePermission('customer:edit'), updateCustomer);
router.delete('/:id', protect, requirePermission('customer:delete'), deleteCustomer);
// cast to Permission to satisfy typings (ensure 'customer:import' is declared in Permission union)
router.post('/import', protect, requirePermission('customer:import' as unknown as any), bulkImportCustomers);

export default router;
