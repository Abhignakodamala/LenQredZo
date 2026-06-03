'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { date: '01 May', collections: 500000, target: 600000 },
  { date: '07 May', collections: 750000, target: 700000 },
  { date: '14 May', collections: 900000, target: 850000 },
  { date: '21 May', collections: 1100000, target: 1000000 },
  { date: '28 May', collections: 1350000, target: 1200000 },
  { date: '31 May', collections: 1500000, target: 1400000 },
];

export default function CollectionsChart() {
  return (
    <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
      <h3 style={{fontWeight:'600',marginBottom:'16px',fontSize:'16px'}}>Collections Overview</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{fontSize: 12}} />
          <YAxis tick={{fontSize: 12}} tickFormatter={(v) => `${v/100000}L`} />
          <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
          <Legend />
          <Line type="monotone" dataKey="collections" stroke="#1e40af" strokeWidth={2} name="Collections" />
          <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Target" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}