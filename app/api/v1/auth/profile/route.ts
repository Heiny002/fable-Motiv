import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { updateUser } from "@/lib/data";

export const runtime = "nodejs";

export const GET = withUser(async (user) => NextResponse.json({ user }));

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  coach_style: z.enum(["gentle", "supportive", "challenging", "drill_sergeant"]).optional(),
  allow_profanity: z.boolean().optional(),
  checkin_hour: z.number().int().min(0).max(23).optional(),
  timezone: z.string().max(64).optional(),
});

export const PUT = withUser(async (user, req) => {
  const patch = await parseBody(req, patchSchema);
  const updated = await updateUser(user.id, patch);
  return NextResponse.json({ user: updated });
});
