/**
 * How the coach backs off when a user stops responding. Pure and DB-free so the
 * policy is easy to reason about and test.
 *
 *   0 days  ..  < REDUCE  -> normal
 *   REDUCE  ..  < PAUSE   -> at most ONE coach-initiated message per local day
 *   PAUSE+                -> nothing unprompted until the user comes back
 */
export const REDUCE_AFTER_DAYS = 14;
export const PAUSE_AFTER_DAYS = 30;

export type InactivityStage = 0 | 1 | 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export function idleDays(lastActivityMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - lastActivityMs) / DAY_MS));
}

export function stageForIdleDays(days: number): InactivityStage {
  if (days >= PAUSE_AFTER_DAYS) return 2;
  if (days >= REDUCE_AFTER_DAYS) return 1;
  return 0;
}

/** Local calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function localDay(iso: string | number | Date, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * One-time heads-up sent when a user crosses a threshold. Deliberately static
 * text — no model call — since the whole point is to stop spending tokens on
 * someone who isn't reading.
 */
export function transitionNotice(stage: 1 | 2, name: string, days: number): { title: string; body: string } {
  if (stage === 1) {
    return {
      title: "Scaling back check-ins",
      body: `Hey ${name}, it's been ${days} days since I heard from you, so I'm cutting back to one check-in a day. If it stays quiet I'll pause them completely at ${PAUSE_AFTER_DAYS} days. Message me whenever you're ready — no guilt, we pick up right where we left off.`,
    };
  }
  return {
    title: "Pausing check-ins",
    body: `Hey ${name}, I haven't heard from you in ${days} days, so I'm pausing check-ins to stay out of your way. Your goals, plan, and memories are all saved. Send me a message any time and I'll pick right back up.`,
  };
}
