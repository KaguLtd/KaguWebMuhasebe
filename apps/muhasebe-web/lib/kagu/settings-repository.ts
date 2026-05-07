import type { PeriodLockConfig } from "./contracts";
import { prisma } from "@/server/db";

const PERIOD_LOCK_SETTING_KEY = "periodLock";

type PeriodLockSettingValue = {
  isActive?: boolean;
  lockDate?: string | null;
  updatedByUserId?: string | null;
};

export async function getDbPeriodLock(): Promise<PeriodLockConfig> {
  const setting = await prisma.setting.findUnique({
    where: { key: PERIOD_LOCK_SETTING_KEY },
  });

  return periodLockConfigFromSetting(setting);
}

export async function saveDbPeriodLock(
  payload: { lockDate: string | null; isActive: boolean },
  actorUserId: string,
): Promise<PeriodLockConfig> {
  const normalizedDate = payload.lockDate?.trim() ? payload.lockDate.trim() : null;

  const setting = await prisma.setting.upsert({
    where: { key: PERIOD_LOCK_SETTING_KEY },
    create: {
      key: PERIOD_LOCK_SETTING_KEY,
      value: {
        isActive: payload.isActive,
        lockDate: normalizedDate,
        updatedByUserId: actorUserId,
      },
    },
    update: {
      value: {
        isActive: payload.isActive,
        lockDate: normalizedDate,
        updatedByUserId: actorUserId,
      },
    },
  });

  return periodLockConfigFromSetting(setting);
}

function periodLockConfigFromSetting(
  setting: {
    value: unknown;
    updatedAt: Date;
  } | null,
): PeriodLockConfig {
  const value =
    setting?.value && typeof setting.value === "object"
      ? (setting.value as PeriodLockSettingValue)
      : undefined;

  return {
    isActive: value?.isActive === true && typeof value.lockDate === "string" && value.lockDate.length > 0,
    lockDate: typeof value?.lockDate === "string" && value.lockDate.length > 0 ? value.lockDate : null,
    updatedAt: setting?.updatedAt.toISOString() ?? null,
    updatedByUserId:
      typeof value?.updatedByUserId === "string" && value.updatedByUserId.length > 0
        ? value.updatedByUserId
        : null,
  };
}
