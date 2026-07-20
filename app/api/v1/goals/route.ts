import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { computeStreak, listGoalsWithPlans, recentCheckIns } from "@/lib/data";

export const runtime = "nodejs";

export const GET = withUser(async (user) => {
  const [goals, checkIns] = await Promise.all([
    listGoalsWithPlans(user.id),
    recentCheckIns(user.id),
  ]);
  return NextResponse.json({
    goals,
    streak: computeStreak(checkIns, user.timezone),
  });
});
