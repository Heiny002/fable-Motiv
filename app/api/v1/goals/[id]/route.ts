import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { getGoal, updateGoal } from "@/lib/data";

export const runtime = "nodejs";

export const GET = withUser(async (user, _req, params) => {
  const goal = await getGoal(user.id, params.id);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
  target_date: z.string().nullable().optional(),
});

export const PUT = withUser(async (user, req, params) => {
  const patch = await parseBody(req, patchSchema);
  const goal = await updateGoal(user.id, params.id, patch);
  return NextResponse.json({ goal });
});
