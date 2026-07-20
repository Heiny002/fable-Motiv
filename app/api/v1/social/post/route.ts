import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { generateSocialPost } from "@/lib/coach/social";
import { getGoal } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  goal_id: z.string().uuid(),
  platform: z.enum(["instagram", "x", "linkedin"]),
});

export const POST = withUser(async (user, req) => {
  const body = await parseBody(req, schema);
  const goal = await getGoal(user.id, body.goal_id);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const post = await generateSocialPost(user, goal, body.platform);
  return NextResponse.json({ post });
});
