import { NextResponse } from "next/server";

import { getDbBootstrap } from "@/lib/kagu/master-repository";

export async function GET() {
  try {
    const payload = await getDbBootstrap();

    return NextResponse.json({ ...payload, lookups: {} });
  } catch (error) {
    console.error("Bootstrap failed", error);

    return NextResponse.json(
      {
        error:
          "PostgreSQL baglantisi kurulamadi. Local deneme icin veritabani calisir olmali.",
      },
      { status: 503 },
    );
  }
}
