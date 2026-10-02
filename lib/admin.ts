/** Admin accounts: comma-separated ADMIN_EMAILS, falling back to the owner. */
const DEFAULT_ADMIN = "jimheiniger@yahoo.com";

export function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
