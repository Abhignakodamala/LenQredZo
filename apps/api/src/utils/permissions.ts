// Central role-based permissions for staff RBAC (Phase A).
// Everyone who is logged in can VIEW company data; these permissions gate ACTIONS only.

export const ROLES = [
  'owner',            // Finance Owner — full access
  'branch_manager',   // Branch operations
  'loan_officer',     // Loan approval
  'accountant',       // Finance / accounting
  'collection_agent', // EMI collection
  'recovery_officer', // Default recovery
] as const;
export type Role = typeof ROLES[number];

export type Permission =
  | 'customer:create' | 'customer:edit' | 'customer:delete'
  | 'loan:create' | 'loan:approve'
  | 'collection:collect' | 'penalty:waive'
  | 'recovery:manage'
  | 'data:export' | 'audit:view'
  | 'staff:manage';

const rolePermissions: Record<string, Permission[]> = {
  owner: [
    'customer:create', 'customer:edit', 'customer:delete',
    'loan:create', 'loan:approve',
    'collection:collect', 'penalty:waive',
    'recovery:manage',
    'data:export', 'audit:view',
    'staff:manage',
  ],
  branch_manager: [
    'customer:create', 'customer:edit', 'customer:delete',
    'loan:create', 'loan:approve',
    'collection:collect', 'penalty:waive',
    'recovery:manage',
    'data:export', 'audit:view',
  ],
  loan_officer: [
    'customer:create', 'customer:edit',
    'loan:create', 'loan:approve',
  ],
  accountant: [
    'data:export', 'audit:view',
  ],
  collection_agent: [
    'collection:collect',
  ],
  recovery_officer: [
    'collection:collect', 'recovery:manage',
  ],
};

// Backwards compatibility: the existing admin user has role 'admin' — treat it as full owner
// so nobody gets locked out. (Migrate that user's role to 'owner' later.)
rolePermissions['admin'] = rolePermissions['owner'];
rolePermissions['Super Admin'] = rolePermissions['owner'];


export function can(role: string, permission: Permission): boolean {
  const perms = rolePermissions[role] || [];
  return perms.includes(permission);
}

// Express middleware: block the request unless req.user.role has the permission.
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: 'Not authenticated' });
    if (!can(role, permission)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

// Friendly labels for the UI.
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Finance Owner',
  branch_manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  accountant: 'Accountant',
  collection_agent: 'Collection Agent',
  recovery_officer: 'Recovery Officer',
  admin: 'Finance Owner',
  'Super Admin': 'Finance Owner',
};