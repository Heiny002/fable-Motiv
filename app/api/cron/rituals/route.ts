import { NextResponse } from "next/server";
import {
  carryOverIncomplete,
  getPowerTasks,
  listPowerDaysToResolve,
  listUsers,
  setPowerDayStatus,
} from "@/lib/data";
import { userLocalDate } from "@/lib/date";
import { fireRitual } from "@/lib/coach/rituals";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Local wall-clock ("HH:MM" and hour) for a user's timezone. */
function localClock(tz: string): { hm: string; hour: number } | null {
  try {
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    return { hm, hour: parseInt(hm.slice(0, 2), 10) };
  } catch {
    return null;
  }
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
    if (user.bedtime && user.bedtime === clock.hm) {
      try {
        await fireRitual(user, "evening");
        evening += 1;
      } catch (err) {
        console.error("[rituals] evening error:", err);
      }
    }

    // --- Morning nudge (wake time): intention + safety-net. Auto-carry
    // yesterday's unfinished tasks only if today hasn't been planned. ---
    if (user.wake_time && user.wake_time === clock.hm) {
      try {
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
