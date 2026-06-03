import { Router } from 'express';
import { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from './customers.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.get('/', protect, getAllCustomers);
router.get('/:id', protect, getCustomerById);
router.post('/', protect, createCustomer);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);

export default router;