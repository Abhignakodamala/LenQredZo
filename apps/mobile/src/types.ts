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
  companyName?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  kycStatus?: 'pending' | 'verified' | 'rejected';
  activeLoansCount?: number;
  email?: string;
}

export interface EMIItem {
  id: number;
  loanId: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  branchName?: string;
  companyName?: string;
  loanType?: string;
  amount: number;
  paidAmount?: number;
  remaining?: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  penalty?: number;
  penaltyPaid?: boolean;
  daysOverdue?: number;
  loan?: {
    id: number;
    amount: number;
    status: string;
    customer?: {
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
  verificationPhoto?: string;
}

export interface DashboardStats {
  totalDisbursed: number;
  totalCollections: number;
  activeCustomers: number;
  activeLoans: number;
  totalLoans: number;
  npaPercentage: number;
  netProfit: number;
  collectionEfficiency: number;
  recentLoans: {
    id: number;
    type?: string;
    amount: number;
    status: string;
    createdAt: string;
    customer?: {
      name: string;
      phone?: string;
    };
  }[];
  aiInsights?: {
    icon: string;
    title: string;
    description: string;
    level: string;
  }[];
}

export interface LoanItem {
  id: number;
  amount: number;
  interestRate?: number;
  tenure?: number;
  frequency?: string;
  status: string;
  type?: string;
  createdAt: string;
  customer?: {
    id: number;
    name: string;
    phone: string;
    city?: string;
  };
}
