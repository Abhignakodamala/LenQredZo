import { Router } from 'express';

import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
import { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, bulkImportCustomers } from './customers.controller';

const router = Router();

// Viewing is open to all logged-in staff.
router.get('/', protect, getAllCustomers);
router.get('/:id', protect, getCustomerById);
router.post('/bulk-import', protect, bulkImportCustomers);
// Actions are gated by permission.
router.post('/', protect, requirePermission('customer:create'), createCustomer);
router.put('/:id', protect, requirePermission('customer:edit'), updateCustomer);
router.delete('/:id', protect, requirePermission('customer:delete'), deleteCustomer);
// cast to Permission to satisfy typings (ensure 'customer:import' is declared in Permission union)
router.post('/import', protect, requirePermission('customer:import' as unknown as any), bulkImportCustomers);

export default router;