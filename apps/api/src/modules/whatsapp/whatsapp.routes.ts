import { Router } from 'express';
import { protect } from '../../middleware/auth';
import {
  sendManualMessage,
  sendPendingEmiReminders,
  saveWhatsAppSettings,
  getWhatsAppSettings,
  getWhatsAppCustomers,
  getMessageTypes,
  getCustomerMessages
} from './whatsapp.controller';

const router = Router();

router.get('/customers', protect, getWhatsAppCustomers);
router.get('/settings', protect, getWhatsAppSettings);
router.put('/settings', protect, saveWhatsAppSettings);
router.get('/message-types', protect, getMessageTypes);
router.get('/messages/:customerId', protect, getCustomerMessages);
router.post('/send', protect, sendManualMessage);
router.post('/reminders/pending-emi', protect, sendPendingEmiReminders);
export default router;
