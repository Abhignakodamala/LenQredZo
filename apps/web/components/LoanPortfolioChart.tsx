'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

const RADIAN = Math.PI / 180;
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function LoanPortfolioChart({ data }: { data?: any[] }) {
  const hasData = data && data.length > 0;
  const chartData = hasData ? data : [{ name: 'No loans yet', value: 1 }];

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontWeight: '600', marginBottom: '4px', fontSize: '16px' }}>Loan Portfolio Summary</h3>
      {hasData && (
        <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 8px' }}>
          Total: ₹{data!.reduce((s, d) => s + d.value, 0).toLocaleString('en-IN')}
        </p>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={hasData ? 3 : 0}
            dataKey="value"
            labelLine={false}
            label={hasData ? renderLabel : undefined}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={hasData ? COLORS[index % COLORS.length] : '#e5e7eb'} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => '₹' + Number(v).toLocaleString('en-IN')} />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}