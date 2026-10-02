import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Validate a signup invite code against INVITE_CODES (comma-separated).
 * Fails CLOSED: if no codes are configured, nobody can register — a missing env
 * var must never silently turn into open signup. Returns the normalized code
 * that matched, or null.
 */
export function matchInviteCode(input: string): string | null {
  const codes = (process.env.INVITE_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const candidate = input.trim().toLowerCase();
  if (!candidate) return null;
  let matched: string | null = null;
  // Compare against every code (no early exit) so timing doesn't leak which matched.
  for (const code of codes) {
    if (safeEqual(candidate, code)) matched = code;
  }
  return matched;
}

export function invitesConfigured(): boolean {
  return (process.env.INVITE_CODES ?? "").split(",").some((c) => c.trim());
}
