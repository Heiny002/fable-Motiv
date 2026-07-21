import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { deletePowerTask, updatePowerTask } from "@/lib/data";

export const runtime = "nodejs";

const schema = z.object({
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
});

export const PATCH = withUser(async (user, req, params) => {
  const patch = await parseBody(req, schema);
  const task = await updatePowerTask(user.id, params.id, patch);
  return NextResponse.json({ task });
});

export const DELETE = withUser(async (user, _req, params) => {
  await deletePowerTask(user.id, params.id);
  return NextResponse.json({ ok: true });
});
