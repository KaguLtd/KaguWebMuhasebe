"use server";

import { redirect } from "next/navigation";

import { loginWithPassword, logoutCurrentSession } from "@/lib/auth/server";
import { HttpError } from "@/lib/http/errors";

export async function signIn(username: string, password: string) {
  if (!username.trim() || !password.trim()) {
    throw new HttpError(400, "Kullanıcı adı ve şifre zorunludur");
  }

  await loginWithPassword(username.trim(), password);
  redirect("/dashboard");
}

export async function signOut() {
  await logoutCurrentSession();
  redirect("/login");
}
