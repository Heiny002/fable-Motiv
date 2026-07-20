import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listActiveEvents } from "@/lib/data";

export const runtime = "nodejs";

// Active (pending) timers & scheduled check-ins — powers the chat timer badge.
export const GET = withUser(async (user) => {
  const events = await listActiveEvents(user.id);
  return NextResponse.json({ events });
});
