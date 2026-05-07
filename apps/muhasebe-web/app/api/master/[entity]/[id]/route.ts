import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/server";
import {
  requireAdminRole,
  requirePermissions,
  routePermissions,
} from "@/lib/http/authorization";
import { jsonBadRequest } from "@/lib/http/response";
import {
  deleteDbMaster,
  getDbMaster,
  isDbMasterEntity,
} from "@/lib/kagu/master-repository";

type RouteContext = {
  params: Promise<{ entity: string; id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { entity, id } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
    }

    await requirePermissions(
      user,
      routePermissions.masterRead(entity),
      "Master verisini gorme yetkiniz yok",
    );

    const item = await getDbMaster(entity, id);

    if (!item) {
      return NextResponse.json({ error: "Master record not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return jsonBadRequest(error, "Kayit getirilemedi");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { entity, id } = await context.params;

    if (!isDbMasterEntity(entity)) {
      return NextResponse.json({ error: "Unknown master entity" }, { status: 404 });
    }

    requireAdminRole(user, "Hard delete yalnizca yonetici icin aciktir");

    return NextResponse.json({ deleted: await deleteDbMaster(entity, id) });
  } catch (error) {
    return jsonBadRequest(error, "Kayit silinemedi");
  }
}
