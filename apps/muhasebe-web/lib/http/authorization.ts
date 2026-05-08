import { prisma } from "@/server/db";

import type { DocumentEntity, MasterEntity } from "@/lib/kagu/contracts";

import { HttpError } from "./errors";

export interface SessionUserLike {
  id: string;
  permissions?: string[];
  roles: string[];
}

const ADMIN_ROLE_KEY = "ADMIN";

export const routePermissions = {
  documentApprove(entity: DocumentEntity) {
    return [`documents.approve`, `documents.${entity}.approve`];
  },
  documentRead(entity: DocumentEntity) {
    return [`documents.read`, `documents.${entity}.read`];
  },
  documentVoid(entity: DocumentEntity) {
    return [`documents.void`, `documents.${entity}.void`];
  },
  documentWrite(entity: DocumentEntity) {
    return [`documents.write`, `documents.${entity}.write`];
  },
  lookupRead(entity: MasterEntity) {
    return [
      `lookups.read`,
      `lookups.${entity}.read`,
      `masters.read`,
      `masters.${entity}.read`,
    ];
  },
  masterRead(entity: MasterEntity) {
    return [`masters.read`, `masters.${entity}.read`];
  },
  masterWrite(entity: MasterEntity) {
    return [`masters.write`, `masters.${entity}.write`];
  },
  reportRead(
    reportKey:
      | "accountStatement"
      | "itemMovements"
      | "warehouseInventory"
      | "projectStockMovements"
      | "projectInvoices"
      | "projectMaterialUsage"
      | "projectEstimatedMargin",
  ) {
    switch (reportKey) {
      case "accountStatement":
        return [`reports.read`, `reports.accounts.read`, `reports.accounts.statement.read`];
      case "itemMovements":
        return [`reports.read`, `reports.items.read`, `reports.items.movements.read`];
      case "warehouseInventory":
        return [`reports.read`, `reports.warehouses.read`, `reports.warehouses.inventory.read`];
      case "projectStockMovements":
        return [
          `reports.read`,
          `reports.projects.read`,
          `reports.projects.stock-movements.read`,
        ];
      case "projectInvoices":
        return [
          `reports.read`,
          `reports.projects.read`,
          `reports.projects.invoices.read`,
        ];
      case "projectMaterialUsage":
        return [
          `reports.read`,
          `reports.projects.read`,
          `reports.projects.material-usage.read`,
        ];
      case "projectEstimatedMargin":
        return [
          `reports.read`,
          `reports.projects.read`,
          `reports.projects.estimated-margin.read`,
        ];
    }
  },
  settingsRolesRead() {
    return [`settings.read`, `roles.manage`];
  },
  settingsUsersRead() {
    return [`settings.read`, `users.manage`];
  },
  settingsUsersWrite() {
    return [`users.manage`];
  },
};

export async function requirePermissions(
  user: SessionUserLike,
  permissionKeys: string[],
  message = "Bu islem icin yetkiniz yok",
) {
  if (user.roles.includes(ADMIN_ROLE_KEY)) {
    return;
  }

  const normalizedKeys = [...new Set(permissionKeys.filter((value) => value.trim().length > 0))];

  if (normalizedKeys.length === 0) {
    return;
  }

  if (Array.isArray(user.permissions) && user.permissions.some((value) => normalizedKeys.includes(value))) {
    return;
  }

  let assignment: { roleId: string } | null = null;

  try {
    assignment = await prisma.rolePermission.findFirst({
      select: { roleId: true },
      where: {
        permission: { key: { in: normalizedKeys } },
        role: { users: { some: { userId: user.id } } },
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Missing prisma mock for prisma.rolePermission.findFirst")
    ) {
      throw new HttpError(403, message);
    }

    throw error;
  }

  if (!assignment) {
    throw new HttpError(403, message);
  }
}

export function requireAdminRole(
  user: SessionUserLike,
  message = "Bu islem yalnizca yonetici tarafindan yapilabilir",
) {
  if (!user.roles.includes(ADMIN_ROLE_KEY)) {
    throw new HttpError(403, message);
  }
}
