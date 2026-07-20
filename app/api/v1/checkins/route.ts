import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { checkInReply } from "@/lib/coach/checkin";
import { addCheckIn, computeStreak, listGoals, recentCheckIns } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  mood: z.number().int().min(1).max(5),
  note: z.string().max(2000).default(""),
});

export const GET = withUser(async (user) => {
  const checkIns = await recentCheckIns(user.id);
  return NextResponse.json({
    checkins: checkIns,
    streak: computeStreak(checkIns, user.timezone),
  });
});

export const POST = withUser(async (user, req) => {
  const body = await parseBody(req, schema);
  const reply = await checkInReply(user, body);
  const goals = await listGoals(user.id);
  const focus = goals.find((g) => g.is_focus && g.status === "active");
  const checkin = await addCheckIn({
    user_id: user.id,
    goal_id: focus?.id ?? null,
    mood: body.mood,
    note: body.note,
    coach_reply: reply,
  });
  const checkIns = await recentCheckIns(user.id);
  return NextResponse.json({ checkin, streak: computeStreak(checkIns, user.timezone) });
});
