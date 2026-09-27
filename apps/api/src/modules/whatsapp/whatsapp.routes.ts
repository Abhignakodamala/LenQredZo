import { Router } from 'express';
import { protect } from '../../middleware/auth';
import {
  sendManualMessage,
  sendPendingEmiReminders,
  saveWhatsAppSettings,
  getWhatsAppSettings,
  getMessageTypes
} from './whatsapp.controller';

const router = Router();

router.get('/settings', protect, getWhatsAppSettings);
router.put('/settings', protect, saveWhatsAppSettings);
router.get('/message-types', protect, getMessageTypes);
router.post('/send', protect, sendManualMessage);
router.post('/reminders/pending-emi', protect, sendPendingEmiReminders);

export default router;
