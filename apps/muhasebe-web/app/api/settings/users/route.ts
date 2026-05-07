import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/server";
import { createUser, listUsers } from "@/lib/admin/user-repository";
import { jsonBadRequest } from "@/lib/http/response";
import { parseUserPayload } from "@/lib/http/validation";

export async function GET() {
  try {
    await requireAdminUser();

    return NextResponse.json({ items: await listUsers() });
  } catch (error) {
    return jsonBadRequest(error, "Kullanicilar listelenemedi");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = await parseUserPayload(request);

    return NextResponse.json({
      item: await createUser({
        email: payload.email,
        fullName: String(payload.fullName),
        isActive: payload.isActive !== false,
        password: String(payload.password),
        roleIds: payload.roleIds,
        username: String(payload.username),
      }),
    });
  } catch (error) {
    return jsonBadRequest(error, "Kullanici olusturulamadi");
  }
}
