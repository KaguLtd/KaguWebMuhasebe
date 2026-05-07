import { NextResponse } from "next/server";

import { HttpError, isHttpError } from "./errors";

export function jsonError(error: unknown, fallbackMessage: string) {
  if (isHttpError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: 500 },
  );
}

export function jsonBadRequest(error: unknown, fallbackMessage: string) {
  if (isHttpError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: 400 },
  );
}

export function assert(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) {
    throw new HttpError(status, message);
  }
}
