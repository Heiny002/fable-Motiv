import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { deleteMemory } from "@/lib/data";

export const runtime = "nodejs";

export const DELETE = withUser(async (user, _req, params) => {
  await deleteMemory(user.id, params.id);
  return NextResponse.json({ ok: true });
});
