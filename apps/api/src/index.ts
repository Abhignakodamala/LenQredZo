import dotenv from 'dotenv';
import path from 'path';dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Locally, load the root .env file. On Railway, env vars are injected directly, so this is just a no-op fallback.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // also load any platform-provided env (Railway)
import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import customerRoutes from './modules/customers/customers.routes';
import loanRoutes from './modules/loans/loans.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import branchRoutes from './modules/branches/branches.routes';
import settingsRoutes from './modules/settings/settings.routes';
import exportRoutes from './modules/export/export.routes';
import auditRoutes from './modules/audit/audit.routes';
import staffRoutes from './modules/staff/staff.routes';

import aiRoutes from './modules/ai/ai.routes';

const app = express();
const PORT = process.env.PORT || 5000;

// Lock CORS to your frontend origin (set CLIENT_URL in .env when you deploy; defaults to local dev).
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Needed so the login rate-limiter sees real client IPs behind a host/proxy.
app.set('trust proxy', 1);
// Cap request body size to blunt oversized-payload abuse.
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ai', aiRoutes);
app.get('/', (req, res) => {
  res.json({ message: 'FinSmart AI API is running!' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});