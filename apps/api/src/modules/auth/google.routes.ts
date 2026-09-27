import { Router } from 'express';
import { googleLogin } from './google.controller';

const router = Router();

router.post('/login', googleLogin);

export default router;
