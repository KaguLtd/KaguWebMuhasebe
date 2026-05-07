"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  isPlaceholderAuthEnabled,
  PLACEHOLDER_SESSION_COOKIE,
} from "@/lib/auth/session";

export async function signInPlaceholder() {
  if (!isPlaceholderAuthEnabled()) {
    redirect("/login?auth=locked");
  }

  const cookieStore = await cookies();

  cookieStore.set(PLACEHOLDER_SESSION_COOKIE, "active", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
  });

  redirect("/dashboard");
}

export async function signOutPlaceholder() {
  const cookieStore = await cookies();

  cookieStore.delete(PLACEHOLDER_SESSION_COOKIE);
  redirect("/login");
}
