export const PLACEHOLDER_SESSION_COOKIE = "kagu_placeholder_session";

export function isPlaceholderAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.KAGU_ALLOW_PLACEHOLDER_AUTH === "true"
  );
}

export function isPlaceholderSession(value: string | undefined) {
  return isPlaceholderAuthEnabled() && value === "active";
}
