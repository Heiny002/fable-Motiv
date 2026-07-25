import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { computeDayStreak, getPowerDay, getPowerDaysBetween, getPowerTasks } from "@/lib/data";
import { userLocalDate } from "@/lib/date";

export const runtime = "nodejs";

// Today's + tomorrow's Power List, the win streak, and today's day status.
export const GET = withUser(async (user) => {
  const today = userLocalDate(user.timezone, 0);
  const tomorrow = userLocalDate(user.timezone, 1);
  const from = userLocalDate(user.timezone, -90);

  const [todayTasks, tomorrowTasks, days, todayDay] = await Promise.all([
    getPowerTasks(user.id, today),
    getPowerTasks(user.id, tomorrow),
    getPowerDaysBetween(user.id, from, today),
    getPowerDay(user.id, today),
  ]);

  return NextResponse.json({
    today: { date: today, tasks: todayTasks, status: todayDay?.status ?? null },
    tomorrow: { date: tomorrow, tasks: tomorrowTasks },
    streak: computeDayStreak(days, today),
  });
});
