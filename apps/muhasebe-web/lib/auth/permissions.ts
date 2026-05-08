export const AUTH_PERMISSIONS = {
  DOCUMENTS_APPROVE: "documents.approve",
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_VOID: "documents.void",
  DOCUMENTS_WRITE: "documents.write",
  MASTERS_READ: "masters.read",
  MASTERS_WRITE: "masters.write",
  REPORTS_READ: "reports.read",
  REPORTS_PROJECTS_READ: "reports.projects.read",
  REPORTS_PROJECTS_ESTIMATED_MARGIN_READ: "reports.projects.estimated-margin.read",
  REPORTS_PROJECTS_INVOICES_READ: "reports.projects.invoices.read",
  REPORTS_PROJECTS_MATERIAL_USAGE_READ: "reports.projects.material-usage.read",
  REPORTS_PROJECTS_STOCK_MOVEMENTS_READ: "reports.projects.stock-movements.read",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_READ: "settings.read",
  USERS_MANAGE: "users.manage",
} as const;

export type AuthPermission = (typeof AUTH_PERMISSIONS)[keyof typeof AUTH_PERMISSIONS];

export const ADMIN_ROLE_KEY = "ADMIN";

export const ADMIN_ROLE_PERMISSIONS = Object.freeze(
  Object.values(AUTH_PERMISSIONS) as AuthPermission[],
);

export function getPermissionsForRoles(roleKeys: readonly string[]) {
  const permissions = new Set<AuthPermission>();

  if (roleKeys.includes(ADMIN_ROLE_KEY)) {
    for (const permission of ADMIN_ROLE_PERMISSIONS) {
      permissions.add(permission);
    }
  }

  return Array.from(permissions);
}

export function hasPermission(
  permissions: readonly AuthPermission[],
  permission: AuthPermission,
) {
  return permissions.includes(permission);
}

export function roleKeysGrantPermission(
  roleKeys: readonly string[],
  permission: AuthPermission,
) {
  return hasPermission(getPermissionsForRoles(roleKeys), permission);
}
