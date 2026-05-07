import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PLACEHOLDER_SESSION_COOKIE } from "@/lib/auth/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession =
    cookieStore.get(PLACEHOLDER_SESSION_COOKIE)?.value === "active";

  redirect(hasSession ? "/dashboard" : "/login");
}
