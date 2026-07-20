import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { claimEvent, getEvent } from "@/lib/data";
import { fireEvent } from "@/lib/coach/events";

export const runtime = "nodejs";
export const maxDuration = 60;

// Client-triggered instant fire: when a timer's countdown hits zero while the
// app is open, the client calls this so the coach debriefs immediately instead
// of waiting up to a minute for the cron sweeper. Idempotent — if the cron
// already claimed the event, this no-ops and the client just refreshes chat.
export const POST = withUser(async (user, _req, params) => {
  const event = await getEvent(user.id, params.id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "pending") return NextResponse.json({ fired: false });

  const claimed = await claimEvent(event.id);
  if (!claimed) return NextResponse.json({ fired: false });

  const message = await fireEvent(user, claimed, { sendPush: false });
  return NextResponse.json({ fired: true, message });
});
