import { Router } from 'express';
import { protect } from '../../middleware/auth';
import { requirePermission } from '../../utils/permissions';
import {
  sendManualMessage,
  sendPendingEmiReminders,
  getUpcomingDueReminders,
  saveWhatsAppSettings,
  getWhatsAppSettings,
  getWhatsAppCustomers,
  getMessageTypes,
  getCustomerMessages,
  simulateCustomerBotMessage,
  getBotLogs,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook
} from './whatsapp.controller';

const router = Router();

// Public Meta WhatsApp Cloud API Webhook handshake & event receiver
router.get('/webhook', verifyWhatsAppWebhook);
router.post('/webhook', handleWhatsAppWebhook);

// Protected Staff & CRM Endpoints
router.get('/upcoming-dues', protect, getUpcomingDueReminders);
router.get('/customers', protect, getWhatsAppCustomers);
router.get('/settings', protect, requirePermission('whatsapp:settings'), getWhatsAppSettings);
router.put('/settings', protect, requirePermission('whatsapp:settings'), saveWhatsAppSettings);
router.get('/message-types', protect, getMessageTypes);
router.get('/messages/:customerId', protect, getCustomerMessages);
router.post('/send', protect, sendManualMessage);
router.post('/reminders/pending-emi', protect, requirePermission('collection:collect'), sendPendingEmiReminders);

// Interactive Self-Service Bot Endpoints
router.post('/bot/simulate', protect, simulateCustomerBotMessage);
router.get('/bot/logs', protect, getBotLogs);

export default router;
