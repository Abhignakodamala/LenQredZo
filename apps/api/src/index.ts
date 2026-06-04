import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';
import customerRoutes from './modules/customers/customers.routes';
import loanRoutes from './modules/loans/loans.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'FinSmart AI API is running!' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
