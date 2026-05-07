import { getCookieStore } from "../mock-state.mjs";

export async function cookies() {
  return getCookieStore();
}
