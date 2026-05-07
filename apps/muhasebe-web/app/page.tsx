import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE } from "@/lib/auth/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE)?.value);

  redirect(hasSession ? "/dashboard" : "/login");
}
