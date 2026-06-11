'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function LoanPortfolioChart({ data }: { data?: any[] }) {
  const hasData = data && data.length > 0;
  const chartData = hasData ? data : [{ name: 'No data yet', value: 1 }];
  const total = hasData ? data!.reduce((s, d) => s + d.value, 0) : 0;

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px' }}>Loan Portfolio Summary</h3>
      {hasData && <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 8px' }}>Total: ₹{total.toLocaleString('en-IN')}</p>}
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={hasData ? 3 : 0} dataKey="value">
            {chartData.map((_: any, i: number) => (
              <Cell key={i} fill={hasData ? COLORS[i % COLORS.length] : '#e5e7eb'} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => '₹' + Number(v).toLocaleString('en-IN')} />
          <Legend iconType="circle" iconSize={10} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}