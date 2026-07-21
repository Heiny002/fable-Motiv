import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { computePowerStreak, getPowerTasks, getPowerTasksBetween } from "@/lib/data";
import { userLocalDate } from "@/lib/date";

export const runtime = "nodejs";

// Today's + tomorrow's Power List, plus the win streak.
export const GET = withUser(async (user) => {
  const today = userLocalDate(user.timezone, 0);
  const tomorrow = userLocalDate(user.timezone, 1);
  const from = userLocalDate(user.timezone, -60);

  const [todayTasks, tomorrowTasks, recent] = await Promise.all([
    getPowerTasks(user.id, today),
    getPowerTasks(user.id, tomorrow),
    getPowerTasksBetween(user.id, from, today),
  ]);

  return NextResponse.json({
    today: { date: today, tasks: todayTasks },
    tomorrow: { date: tomorrow, tasks: tomorrowTasks },
    streak: computePowerStreak(recent, today),
  });
});
