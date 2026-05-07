import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/server";

export default async function HomePage() {
  const sessionUser = await getSessionUser();

  redirect(sessionUser ? "/dashboard" : "/login");
}
