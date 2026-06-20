import { Router } from 'express';
import { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from './customers.controller';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';

const router = Router();

// Viewing is open to all logged-in staff.
router.get('/', protect, getAllCustomers);
router.get('/:id', protect, getCustomerById);

// Actions are gated by permission.
router.post('/', protect, requirePermission('customer:create'), createCustomer);
router.put('/:id', protect, requirePermission('customer:edit'), updateCustomer);
router.delete('/:id', protect, requirePermission('customer:delete'), deleteCustomer);

export default router;