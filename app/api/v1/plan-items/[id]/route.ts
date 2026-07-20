import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { updatePlanItem } from "@/lib/data";

export const runtime = "nodejs";

const schema = z.object({
  completed: z.boolean().optional(),
  title: z.string().min(1).max(300).optional(),
  detail: z.string().max(2000).optional(),
});

export const PATCH = withUser(async (user, req, params) => {
  const patch = await parseBody(req, schema);
  const item = await updatePlanItem(user.id, params.id, patch);
  return NextResponse.json({ item });
});
