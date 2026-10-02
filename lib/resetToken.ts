import { createHash, randomBytes } from "crypto";

export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** A fresh random token (sent to the user) and its hash (the only thing stored). */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
