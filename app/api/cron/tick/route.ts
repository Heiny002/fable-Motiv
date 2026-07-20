import { NextResponse } from "next/server";
import { claimEvent, findUserById, listDueEvents } from "@/lib/data";
import { fireEvent } from "@/lib/coach/events";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs every minute via Supabase pg_cron. Fires any scheduled events (timers,
// reminders, nudges) whose time has arrived — the backstop that works even when
// the user's phone is locked and the in-app countdown is suspended.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await listDueEvents(new Date().toISOString());
  let fired = 0;
  for (const event of due) {
    const claimed = await claimEvent(event.id);
    if (!claimed) continue; // client's fire-on-zero already handled it
    const user = await findUserById(claimed.user_id);
    if (!user) continue;
    try {
      await fireEvent(user, claimed, { sendPush: true });
      fired += 1;
    } catch (err) {
      console.error("tick fireEvent error:", err);
    }
  }
  return NextResponse.json({ due: due.length, fired });
}
