import { NextResponse } from "next/server";

import { loginWithPassword } from "@/lib/auth/server";
import { jsonBadRequest } from "@/lib/http/response";
import { parseLoginPayload } from "@/lib/http/validation";

export async function POST(request: Request) {
  try {
    const payload = await parseLoginPayload(request);

    await loginWithPassword(payload.username, payload.password, request);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonBadRequest(error, "Giris yapilamadi");
  }
}
