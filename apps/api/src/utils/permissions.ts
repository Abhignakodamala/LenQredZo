// Central role-based access control (RBAC) and permissions for LenQredzo.
// Strict data & feature gating: each role ONLY sees & performs what relates to their specific job.

export const ROLES = [
  'owner',            // Finance Owner / Super Admin — full company access
  'branch_manager',   // Branch operations & approvals
  'loan_officer',     // Loan review & sanctioning
  'accountant',       // Finance, ledgers & audit reports
  'collection_agent', // EMI collection & field visits
  'recovery_officer', // Overdue recovery
] as const;
export type Role = typeof ROLES[number];

export type Permission =
  | 'customer:create' | 'customer:edit' | 'customer:delete'
  | 'loan:create' | 'loan:approve'
  | 'collection:collect' | 'penalty:waive'
  | 'recovery:manage'
  | 'data:export' | 'audit:view'
  | 'staff:manage'
  | 'settings:manage' | 'settings:view'
  | 'branch:manage' | 'whatsapp:settings';

export function normalizeRole(role?: string): string {
  if (!role) return '';
  const lower = role.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (lower === 'super_admin' || lower === 'admin') return 'owner';
  if (lower === 'manager') return 'branch_manager';
  if (lower === 'agent') return 'collection_agent';
  return lower;
}

const rolePermissions: Record<string, Permission[]> = {
  owner: [
    'customer:create', 'customer:edit', 'customer:delete',
    'loan:create', 'loan:approve',
    'collection:collect', 'penalty:waive',
    'recovery:manage',
    'data:export', 'audit:view',
    'staff:manage',
    'settings:manage', 'settings:view',
    'branch:manage', 'whatsapp:settings'
  ],
  branch_manager: [
    'customer:create', 'customer:edit', 'customer:delete',
    'loan:create', 'loan:approve',
    'collection:collect', 'penalty:waive',
    'recovery:manage',
    'data:export', 'audit:view'
  ],
  loan_officer: [
    'customer:create', 'customer:edit',
    'loan:create', 'loan:approve'
  ],
  accountant: [
    'collection:collect',
    'data:export', 'audit:view'
  ],
  collection_agent: [
    'collection:collect'
  ],
  recovery_officer: [
    'collection:collect',
    'recovery:manage'
  ]
};

// Aliases
rolePermissions['admin'] = rolePermissions['owner'];
rolePermissions['super_admin'] = rolePermissions['owner'];

export function can(role: string, permission: Permission): boolean {
  const norm = normalizeRole(role);
  const perms = rolePermissions[norm] || [];
  return perms.includes(permission);
}

// Express middleware: block the request unless req.user.role has the permission.
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: 'Not authenticated' });
    if (!can(role, permission)) {
      return res.status(403).json({
        message: 'Forbidden: You do not have permission to perform this action or view this resource.'
      });
    }
    next();
  };
}

// Friendly labels for the UI
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Finance Owner',
  admin: 'Finance Owner',
  'Super Admin': 'Super Admin',
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  Manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  accountant: 'Accountant',
  Accountant: 'Accountant',
  collection_agent: 'Collection Agent',
  Agent: 'Collection Agent',
  recovery_officer: 'Recovery Officer',
};
