import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { cancelEvent } from "@/lib/data";

export const runtime = "nodejs";

// Cancel a pending timer / scheduled check-in.
export const DELETE = withUser(async (user, _req, params) => {
  await cancelEvent(user.id, params.id);
  return NextResponse.json({ ok: true });
});
