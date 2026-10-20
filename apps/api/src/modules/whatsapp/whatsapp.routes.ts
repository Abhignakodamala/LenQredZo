import { Router } from 'express';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
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
router.get('/settings', protect, requirePermission('whatsapp:settings'), getWhatsAppSettings);
router.put('/settings', protect, requirePermission('whatsapp:settings'), saveWhatsAppSettings);
router.get('/message-types', protect, getMessageTypes);
router.get('/messages/:customerId', protect, getCustomerMessages);
router.post('/send', protect, sendManualMessage);
router.post('/reminders/pending-emi', protect, requirePermission('collection:collect'), sendPendingEmiReminders);

export default router;
