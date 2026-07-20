import { NextResponse } from "next/server";
import { usersForCheckinHour } from "@/lib/data";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs hourly via Vercel Cron; pings users whose local time matches their
// chosen check-in hour.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await usersForCheckinHour(new Date());
  let notified = 0;
  for (const user of due) {
    const sent = await sendPushToUser(user.id, {
      title: "Time to check in 🏁",
      body: `${user.name}, your coach is waiting. How did today go?`,
      url: "/checkin",
    });
    if (sent > 0) notified += 1;
  }
  return NextResponse.json({ due: due.length, notified });
}
