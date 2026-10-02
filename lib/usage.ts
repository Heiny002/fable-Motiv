import { isAdmin } from "./admin";
import { countUsageSince, earliestUsageSince, recordUsage } from "./data";
import type { PublicUser } from "./types";

/** Rolling 24h cap on user-initiated AI requests (chat, check-in replies, social posts). */
export const DAILY_CAP = Math.max(1, parseInt(process.env.DAILY_MESSAGE_CAP ?? "", 10) || 40);
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UsageResult {
  ok: boolean;
  used: number;
  cap: number;
  /** When the oldest counted request ages out and a slot frees up. */
  resetsAt?: string;
}

/**
 * Check the user's rolling 24h usage and, if under the cap, record this request.
 * Admins are exempt. Recording happens before the model runs so a failed or
 * abandoned call still counts — otherwise retries could be used to dodge the cap.
 */
export async function takeUsage(user: PublicUser, kind: string): Promise<UsageResult> {
  if (isAdmin(user.email)) return { ok: true, used: 0, cap: DAILY_CAP };
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const used = await countUsageSince(user.id, since);
  if (used >= DAILY_CAP) {
    const oldest = await earliestUsageSince(user.id, since);
    return {
      ok: false,
      used,
      cap: DAILY_CAP,
      resetsAt: oldest ? new Date(new Date(oldest).getTime() + WINDOW_MS).toISOString() : undefined,
    };
  }
  await recordUsage(user.id, kind);
  return { ok: true, used: used + 1, cap: DAILY_CAP };
}

export function capMessage(r: UsageResult): string {
  const when = r.resetsAt
    ? new Date(r.resetsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "later today";
  return `You've hit today's limit of ${r.cap} messages with your coach. A slot frees up around ${when} — your goals, plan, and Power List all still work in the meantime.`;
}
