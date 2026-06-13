import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import customerRoutes from './modules/customers/customers.routes';
import loanRoutes from './modules/loans/loans.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import branchRoutes from './modules/branches/branches.routes';
import settingsRoutes from './modules/settings/settings.routes';
import exportRoutes from './modules/export/export.routes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/export', exportRoutes);
app.get('/', (req, res) => {
  res.json({ message: 'FinSmart AI API is running!' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});