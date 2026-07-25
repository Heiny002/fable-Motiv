import { NextResponse } from "next/server";
import {
  carryOverIncomplete,
  getPowerTasks,
  listPowerDaysToResolve,
  listUsers,
  setPowerDayStatus,
  updateUser,
} from "@/lib/data";
import { userLocalDate } from "@/lib/date";
import { fireRitual } from "@/lib/coach/rituals";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Local wall-clock ("HH:MM", hour, minutes-since-midnight) for a user's timezone. */
function localClock(tz: string): { hm: string; hour: number; minutes: number } | null {
  try {
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const hour = parseInt(hm.slice(0, 2), 10);
    const minute = parseInt(hm.slice(3, 5), 10);
    return { hm, hour, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// How late a ritual may still fire after its scheduled time. Absorbs a delayed
// or dropped sweeper run without delivering a bedtime nudge the next afternoon.
const CATCH_UP_MINUTES = 120;

/**
 * A ritual is due when the user's local time has reached its scheduled time,
 * we're still inside the catch-up window, and it hasn't already fired today.
 * The date ledger makes this idempotent: repeated or retried sweeper runs in
 * the same local day fire at most once.
 */
function ritualDue(
  scheduled: string | null,
  lastFiredDate: string | null,
  clock: { minutes: number },
  todayStr: string
): boolean {
  if (!scheduled) return false;
  if (lastFiredDate === todayStr) return false;
  const target = toMinutes(scheduled);
  if (target === null) return false;
  const elapsed = clock.minutes - target;
  return elapsed >= 0 && elapsed <= CATCH_UP_MINUTES;
}

// Runs every minute via Supabase pg_cron. Drives the Power List rituals:
//  - resolves finished days (planned -> pending, then -> lost past the noon grace)
//  - fires the bedtime evening nudge and wake-time morning nudge (push)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  let evening = 0;
  let morning = 0;
  let resolved = 0;

  for (const user of users) {
    const clock = localClock(user.timezone);
    if (!clock) continue;
    const todayStr = userLocalDate(user.timezone, 0);
    const yesterdayStr = userLocalDate(user.timezone, -1);

    // --- Day-status sweep: a finished day awaits review (pending); once past the
    // noon grace on the following day it auto-fails (lost). ---
    try {
      const stale = await listPowerDaysToResolve(user.id, todayStr);
      for (const d of stale) {
        let next: "pending" | "lost" | null = null;
        if (d.plan_date < yesterdayStr) {
          next = "lost"; // more than a day overdue
        } else if (d.plan_date === yesterdayStr) {
          next = clock.hour >= 12 ? "lost" : "pending"; // grace until noon
        }
        if (next && next !== d.status) {
          await setPowerDayStatus(user.id, d.plan_date, next);
          resolved += 1;
        }
      }
    } catch (err) {
      console.error("[rituals] sweep error:", err);
    }

    // --- Evening nudge (bedtime): review today + plan tomorrow. ---
    if (ritualDue(user.bedtime, user.last_evening_ritual, clock, todayStr)) {
      try {
        // Claim the day BEFORE sending so a concurrent run can't double-fire.
        await updateUser(user.id, { last_evening_ritual: todayStr });
        await fireRitual(user, "evening");
        evening += 1;
      } catch (err) {
        console.error("[rituals] evening error:", err);
      }
    }

    // --- Morning nudge (wake time): intention + safety-net. Auto-carry
    // yesterday's unfinished tasks only if today hasn't been planned. ---
    if (ritualDue(user.wake_time, user.last_morning_ritual, clock, todayStr)) {
      try {
        await updateUser(user.id, { last_morning_ritual: todayStr });
        const todayTasks = await getPowerTasks(user.id, todayStr);
        if (todayTasks.length === 0) {
          await carryOverIncomplete(user.id, yesterdayStr, todayStr);
        }
        await fireRitual(user, "morning");
        morning += 1;
      } catch (err) {
        console.error("[rituals] morning error:", err);
      }
    }
  }

  return NextResponse.json({ users: users.length, evening, morning, resolved });
}
