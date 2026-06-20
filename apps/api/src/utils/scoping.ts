// Branch data-scoping for staff RBAC.
// Some roles see the whole company; others see only their assigned branch.

const COMPANY_WIDE_ROLES = ['owner', 'admin', 'accountant', 'Super Admin'];
const BRANCH_SCOPED_ROLES = ['branch_manager', 'loan_officer', 'collection_agent', 'recovery_officer'];

// Returns true if this user is restricted to their own branch.
export function isBranchScoped(user: any): boolean {
  return BRANCH_SCOPED_ROLES.includes(user?.role);
}

// A Prisma `where` filter for CUSTOMER queries (Customer has branchId directly).
// - company-wide roles: filter by company only
// - branch-scoped roles WITH a branch: filter by company + their branch
// - branch-scoped roles WITHOUT a branch: return an impossible filter (see nothing) — fail closed
export function customerScope(user: any): any {
  const base: any = { companyId: user.companyId };
  if (!isBranchScoped(user)) return base;
  if (user.branchId == null) return { ...base, id: -1 }; // no branch assigned -> match nothing
  return { ...base, branchId: user.branchId };
}

// A Prisma `where` filter for LOAN / PAYMENT / EMI queries.
// These tables have no branchId of their own, so we scope THROUGH the customer.
// company-wide roles still scope by company (via the customer relation) for safety.
export function loanScope(user: any): any {
  const customerWhere: any = { companyId: user.companyId };
  if (isBranchScoped(user)) {
    if (user.branchId == null) {
      customerWhere.id = -1; // no branch assigned -> match nothing
    } else {
      customerWhere.branchId = user.branchId;
    }
  }
  return { customer: customerWhere };
}

// For EMI queries, the relation path is emi -> loan -> customer.
export function emiScope(user: any): any {
  const customerWhere: any = { companyId: user.companyId };
  if (isBranchScoped(user)) {
    if (user.branchId == null) {
      customerWhere.id = -1;
    } else {
      customerWhere.branchId = user.branchId;
    }
  }
  return { loan: { customer: customerWhere } };
}
// For PAYMENT queries, the relation path is payment -> loan -> customer.
export function paymentScope(user: any): any {
  const customerWhere: any = { companyId: user.companyId };
  if (isBranchScoped(user)) {
    if (user.branchId == null) {
      customerWhere.id = -1;
    } else {
      customerWhere.branchId = user.branchId;
    }
  }
  return { loan: { customer: customerWhere } };
}