'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function CollectionsChart() {
  const [data, setData] = useState<any[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/loans/collections/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const emis = await res.json();

        // Group by due date label
        const grouped: any = {};
        emis.forEach((emi: any) => {
          const label = new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          if (!grouped[label]) grouped[label] = { date: label, collected: 0, pending: 0, overdue: 0 };
          if (emi.status === 'paid') grouped[label].collected += emi.amount;
          else if (emi.status === 'overdue') grouped[label].overdue += emi.amount;
          else grouped[label].pending += emi.amount;
        });

        setData(Object.values(grouped).slice(-8));
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
      <h3 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px' }}>Collections Overview</h3>
      {data.length === 0 ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
          No collection data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 100000).toFixed(1)}L`} />
            <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
            <Legend />
            <Line type="monotone" dataKey="collected" stroke="#1e40af" strokeWidth={2} name="Collected" />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Pending" />
            <Line type="monotone" dataKey="overdue" stroke="#dc2626" strokeWidth={2} name="Overdue" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}