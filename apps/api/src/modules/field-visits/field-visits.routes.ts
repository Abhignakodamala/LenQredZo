import { Router } from 'express';
import { protect } from '../../middleware/auth';
import {
  logFieldVisit,
  getFieldVisits,
  getPtpCalendar
} from './field-visits.controller';

const router = Router();

router.post('/', protect, logFieldVisit);
router.get('/', protect, getFieldVisits);
router.get('/ptp-calendar', protect, getPtpCalendar);

export default router;
