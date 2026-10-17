import { apiRequest } from './api';
import { EMIItem, Customer, CollectPaymentPayload, DashboardStats, LoanItem } from '../types';

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  try {
    const data = await apiRequest<DashboardStats>('/api/dashboard/stats');
    return data;
  } catch (err) {
    console.warn('Failed to load dashboard stats:', err);
    return null;
  }
}

export async function fetchLoans(): Promise<LoanItem[]> {
  try {
    const data = await apiRequest<LoanItem[]>('/api/loans');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to load loans:', err);
    return [];
  }
}

export async function fetchAllCollections(): Promise<EMIItem[]> {
  const data = await apiRequest<EMIItem[]>('/api/loans/collections/all');
  return Array.isArray(data) ? data : [];
}

export async function fetchAllCustomers(): Promise<Customer[]> {
  const data = await apiRequest<Customer[]>('/api/customers');
  return Array.isArray(data) ? data : [];
}

export async function submitEmiCollection(payload: CollectPaymentPayload): Promise<any> {
  const { emiId, payAmount, method, reference, verificationPhoto } = payload;
  const res = await apiRequest(`/api/loans/emi/${emiId}/pay`, {
    method: 'PUT',
    body: {
      payAmount,
      method,
      reference,
      verificationPhoto
    }
  });
  return res;
}

export function isDateToday(dateString: string): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function isDateOverdue(dateString: string, status: string): boolean {
  if (status === 'paid') return false;
  if (!dateString) return false;
  const d = new Date(dateString);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return d < todayStart;
}
