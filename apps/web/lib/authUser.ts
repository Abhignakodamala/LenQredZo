// Reads the logged-in user's info from the JWT stored in localStorage.
// The token payload contains: userId, role, companyId, branchId.

export type AuthUser = {
  userId: number;
  role: string;
  companyId: number | null;
  branchId: number | null;
};

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      userId: payload.userId,
      role: payload.role,
      companyId: payload.companyId ?? null,
      branchId: payload.branchId ?? null,
    };
  } catch {
    return null;
  }
}

// Owner-level roles that can manage staff and see everything.
const OWNER_ROLES = ['owner', 'admin', 'Super Admin'];

export function isOwner(user: AuthUser | null): boolean {
  return !!user && OWNER_ROLES.includes(user.role);
}

// The permission map, mirrored on the frontend for hiding buttons.
// (The backend is the real enforcer; this is just UI convenience.)
const rolePermissions: Record<string, string[]> = {
  owner: ['customer:create','customer:edit','customer:delete','loan:create','loan:approve','collection:collect','penalty:waive','recovery:manage','data:export','audit:view','staff:manage'],
  admin: ['customer:create','customer:edit','customer:delete','loan:create','loan:approve','collection:collect','penalty:waive','recovery:manage','data:export','audit:view','staff:manage'],
  'Super Admin': ['customer:create','customer:edit','customer:delete','loan:create','loan:approve','collection:collect','penalty:waive','recovery:manage','data:export','audit:view','staff:manage'],
  branch_manager: ['customer:create','customer:edit','customer:delete','loan:create','loan:approve','collection:collect','penalty:waive','recovery:manage','data:export','audit:view'],
  loan_officer: ['customer:create','customer:edit','loan:create','loan:approve'],
  accountant: ['data:export','audit:view'],
  collection_agent: ['collection:collect'],
  recovery_officer: ['collection:collect','recovery:manage'],
};

export function can(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  return (rolePermissions[user.role] || []).includes(permission);
}
const BRANCH_SCOPED_ROLES = ['branch_manager', 'loan_officer', 'collection_agent', 'recovery_officer'];

// True if this user is a branch-scoped role with no branch assigned (sees nothing).
export function hasNoBranchAccess(user: AuthUser | null): boolean {
  if (!user) return false;
  return BRANCH_SCOPED_ROLES.includes(user.role) && user.branchId == null;
}