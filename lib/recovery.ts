import { createHash, timingSafeEqual } from "crypto";
import { isAdmin } from "./admin";

/** A short code is guessable, so a too-short RECOVERY_CODE is treated as not configured. */
export const MIN_RECOVERY_CODE_LENGTH = 12;

export const MAX_FAILED_ATTEMPTS = 5; // per rolling hour, across everyone
export const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
export const RECOVERY_LINK_TTL_MS = 15 * 60 * 1000;

export function recoveryConfigured(): boolean {
  return (process.env.RECOVERY_CODE ?? "").trim().length >= MIN_RECOVERY_CODE_LENGTH;
}

/**
 * Constant-time check of a submitted code AND that the email is an admin.
 * Both are folded into one boolean so a caller can't tell which half failed.
 * Fails closed when RECOVERY_CODE is unset or too short.
 */
export function recoveryAllowed(email: string, code: string): boolean {
  const expected = (process.env.RECOVERY_CODE ?? "").trim();
  if (expected.length < MIN_RECOVERY_CODE_LENGTH) return false;
  // Hash both sides so the comparison is fixed-length (no length leak).
  const a = createHash("sha256").update(code.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  const codeOk = timingSafeEqual(a, b);
  return codeOk && isAdmin(email);
}
