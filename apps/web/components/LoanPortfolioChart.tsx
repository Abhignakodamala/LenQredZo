'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const data = [
  { name: 'Personal Loan', value: 45, amount: '₹12,93,75,000' },
  { name: 'Business Loan', value: 25, amount: '₹7,18,75,000' },
  { name: 'Gold Loan', value: 15, amount: '₹4,31,25,000' },
  { name: 'Vehicle Loan', value: 10, amount: '₹2,87,50,000' },
  { name: 'Other Loans', value: 5, amount: '₹1,43,75,000' },
];

const COLORS = ['#1e40af', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

export default function LoanPortfolioChart() {
  return (
    <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
      <h3 style={{fontWeight:'600',marginBottom:'16px',fontSize:'16px'}}>Loan Portfolio Summary</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => `${v}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}