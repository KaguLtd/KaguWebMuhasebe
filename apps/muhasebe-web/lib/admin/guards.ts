import { prisma } from "@/server/db";

import { AUTH_PERMISSIONS, roleKeysGrantPermission } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/http/errors";

const ADMIN_GUARD_PERMISSION = AUTH_PERMISSIONS.USERS_MANAGE;

type ActiveUserRoleRecord = {
  roles: Array<{ role: { key: string } }>;
};

export async function assertLastAdminAccessIsPreserved(input: {
  currentIsActive: boolean;
  currentRoleKeys: string[];
  nextIsActive: boolean;
  nextRoleKeys: string[];
  userId: string;
}) {
  const currentlyProtected =
    input.currentIsActive &&
    roleKeysGrantPermission(input.currentRoleKeys, ADMIN_GUARD_PERMISSION);
  const remainsProtected =
    input.nextIsActive &&
    roleKeysGrantPermission(input.nextRoleKeys, ADMIN_GUARD_PERMISSION);

  if (!currentlyProtected || remainsProtected) {
    return;
  }

  const activeUsers: ActiveUserRoleRecord[] = await prisma.user.findMany({
    where: {
      isActive: true,
      NOT: { id: input.userId },
    },
    include: { roles: { include: { role: true } } },
  });

  const hasAnotherProtectedAdmin = activeUsers.some((user) =>
    roleKeysGrantPermission(
      user.roles.map((membership) => membership.role.key),
      ADMIN_GUARD_PERMISSION,
    ),
  );

  if (!hasAnotherProtectedAdmin) {
    throw new HttpError(
      400,
      "Son aktif admin kullanicisi pasiflestirilemez veya admin yetkisi kaldirilamaz.",
    );
  }
}
