import dotenv from 'dotenv';
import path from 'path';dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Locally, load the root .env file. On Railway, env vars are injected directly, so this is just a no-op fallback.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // also load any platform-provided env (Railway)
import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import webauthnRoutes from './modules/auth/webauthn.routes';
import googleRoutes from './modules/auth/google.routes';
import customerRoutes from './modules/customers/customers.routes';
import loanRoutes from './modules/loans/loans.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import branchRoutes from './modules/branches/branches.routes';
import settingsRoutes from './modules/settings/settings.routes';
import exportRoutes from './modules/export/export.routes';
import auditRoutes from './modules/audit/audit.routes';
import staffRoutes from './modules/staff/staff.routes';

import aiRoutes from './modules/ai/ai.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';

import paymentsRoutes from './modules/payments/payments.routes';
import cashRegisterRoutes from './modules/cash-register/cash-register.routes';
import { startMidnightCronScheduler } from './services/penalty-cron.service';

import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 5000;

// Permissive CORS in dev so frontend never gets blocked on localhost / 127.0.0.1
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      (process.env.CLIENT_URL && process.env.CLIENT_URL.includes(origin))
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
// Needed so the login rate-limiter sees real client IPs behind a host/proxy.
app.set('trust proxy', 1);
// Cap request body size
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded KYC documents and assets statically
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/auth/webauthn', webauthnRoutes);
app.use('/api/auth/google', googleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/cash-register', cashRegisterRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'LenQredZo AI API is running!' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});