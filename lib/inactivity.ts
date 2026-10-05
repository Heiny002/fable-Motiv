/**
 * How the coach backs off when a user stops responding. Pure and DB-free so the
 * policy is easy to reason about and test.
 *
 * Two tracks, because "went quiet" and "never started" deserve different patience:
 *
 *                        engaged (has acted before)   never engaged (signed up, then nothing)
 *   one message a day    after 14 days                after 3 days
 *   fully paused         after 30 days                after 10 days
 *
 * "Engaged" means the user has done something themselves at least once — sent a
 * chat message, completed or added a Power List task, or submitted a check-in.
 * Setting up their profile during onboarding doesn't count.
 */
export const REDUCE_AFTER_DAYS = 14;
export const PAUSE_AFTER_DAYS = 30;
export const NEVER_ENGAGED_REDUCE_AFTER_DAYS = 3;
export const NEVER_ENGAGED_PAUSE_AFTER_DAYS = 10;

export type InactivityStage = 0 | 1 | 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export function thresholds(engaged: boolean): { reduce: number; pause: number } {
  return engaged
    ? { reduce: REDUCE_AFTER_DAYS, pause: PAUSE_AFTER_DAYS }
    : { reduce: NEVER_ENGAGED_REDUCE_AFTER_DAYS, pause: NEVER_ENGAGED_PAUSE_AFTER_DAYS };
}

export function idleDays(lastActivityMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - lastActivityMs) / DAY_MS));
}

export function stageForIdleDays(days: number, engaged = true): InactivityStage {
  const t = thresholds(engaged);
  if (days >= t.pause) return 2;
  if (days >= t.reduce) return 1;
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
export function transitionNotice(
  stage: 1 | 2,
  name: string,
  days: number,
  engaged = true
): { title: string; body: string } {
  const { pause } = thresholds(engaged);
  if (stage === 1) {
    return {
      title: "Scaling back check-ins",
      body: engaged
        ? `Hey ${name}, it's been ${days} days since I heard from you, so I'm cutting back to one check-in a day. If it stays quiet I'll pause them completely at ${pause} days. Message me whenever you're ready — no guilt, we pick up right where we left off.`
        : `Hey ${name}, you signed up ${days} days ago but we haven't talked yet, so I'm cutting back to one check-in a day. Say hi whenever you're ready and tell me the one thing you want to work on — I'll pause check-ins completely at ${pause} days if it stays quiet.`,
    };
  }
  return {
    title: "Pausing check-ins",
    body: engaged
      ? `Hey ${name}, I haven't heard from you in ${days} days, so I'm pausing check-ins to stay out of your way. Your goals, plan, and memories are all saved. Send me a message any time and I'll pick right back up.`
      : `Hey ${name}, it's been ${days} days and we haven't gotten started, so I'm pausing check-ins to stay out of your way. Send me a message any time — tell me a goal and we'll build a plan together.`,
  };
}
