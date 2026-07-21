import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { addPowerTask } from "@/lib/data";
import { userLocalDate } from "@/lib/date";

export const runtime = "nodejs";

const schema = z.object({
  day: z.enum(["today", "tomorrow"]),
  title: z.string().min(1).max(200),
});

export const POST = withUser(async (user, req) => {
  const body = await parseBody(req, schema);
  const planDate = userLocalDate(user.timezone, body.day === "tomorrow" ? 1 : 0);
  const task = await addPowerTask({ user_id: user.id, plan_date: planDate, title: body.title });
  return NextResponse.json({ task });
});
