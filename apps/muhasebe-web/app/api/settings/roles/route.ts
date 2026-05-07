import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/server";
import { listRoles } from "@/lib/admin/user-repository";
import { jsonBadRequest } from "@/lib/http/response";

export async function GET() {
  try {
    await requireAdminUser();

    return NextResponse.json({ items: await listRoles() });
  } catch (error) {
    return jsonBadRequest(error, "Roller getirilemedi");
  }
}
