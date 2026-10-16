export type UserRole = 'owner' | 'admin' | 'Super Admin' | 'branch_manager' | 'loan_officer' | 'accountant' | 'collection_agent' | 'recovery_officer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  branchId?: number;
  branchName?: string;
  companyId: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  kycStatus?: 'pending' | 'verified' | 'rejected';
  activeLoansCount?: number;
}

export interface EMIItem {
  id: number;
  loanId: number;
  amount: number;
  paidAmount?: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'partial';
  penalty?: number;
  penaltyPaid?: boolean;
  loan: {
    id: number;
    amount: number;
    status: string;
    customer: {
      id: number;
      name: string;
      phone: string;
      address?: string;
      city?: string;
    };
  };
}

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer';

export interface CollectPaymentPayload {
  emiId: number;
  payAmount: number;
  method: PaymentMethod;
  reference?: string;
  verificationPhoto?: string; // Base64 image
}
