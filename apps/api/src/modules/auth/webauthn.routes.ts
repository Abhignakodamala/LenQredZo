import { Router } from 'express';
import { protect } from '../../middleware/auth';
import {
  beginRegistration,
  completeRegistration,
  beginAuthentication,
  completeAuthentication,
  listPasskeys,
  deletePasskey,
} from './webauthn.controller';

const router = Router();

router.post('/register/options', protect, beginRegistration);
router.post('/register/verify', protect, completeRegistration);
router.post('/authenticate/options', beginAuthentication);
router.post('/authenticate/verify', completeAuthentication);
router.get('/passkeys', protect, listPasskeys);
router.delete('/passkeys/:id', protect, deletePasskey);

export default router;
