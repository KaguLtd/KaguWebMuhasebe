import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import { requireAdminRole } from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import { parseJsonObject } from "@/lib/http/validation";
import { getDbPeriodLock, saveDbPeriodLock } from "@/lib/kagu/settings-repository";

export async function GET() {
  try {
    const user = await requireSessionUser();

    requireAdminRole(user, "Donem kilidi bilgilerini gorme yetkiniz yok");

    return NextResponse.json(await getDbPeriodLock());
  } catch (error) {
    return jsonBadRequest(error, "Donem kilidi getirilemedi");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();

    requireAdminRole(user, "Donem kilidi degistirme yetkiniz yok");

    const payload = await parseJsonObject(request);
    const lockDate =
      typeof payload.lockDate === "string" && payload.lockDate.trim().length > 0
        ? payload.lockDate.trim()
        : null;
    const isActive = payload.isActive === true;

    return NextResponse.json(
      await saveDbPeriodLock(
        {
          isActive,
          lockDate,
        },
        user.id,
      ),
    );
  } catch (error) {
    return jsonBadRequest(error, "Donem kilidi kaydedilemedi");
  }
}
