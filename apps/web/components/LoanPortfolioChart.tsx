'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#1e40af', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

export default function LoanPortfolioChart({ data }: { data?: any[] }) {
  const chartData = data && data.length > 0 ? data : [{ name: 'No loans yet', value: 1 }];

  return (
    <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
      <h3 style={{fontWeight:'600',marginBottom:'16px',fontSize:'16px'}}>Loan Portfolio Summary</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => '₹' + Number(v).toLocaleString('en-IN')} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}