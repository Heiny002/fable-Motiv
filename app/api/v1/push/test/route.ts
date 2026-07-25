import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listPushSubscriptions } from "@/lib/data";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

// Send a test notification to every device registered for this user, and report
// what actually happened — this is how you tell "the browser thinks it's
// subscribed" apart from "the server can really reach a device".
export const POST = withUser(async (user) => {
  const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const subs = await listPushSubscriptions(user.id);

  if (!configured) {
    return NextResponse.json({
      ok: false,
      reason: "not_configured",
      registered: subs.length,
      sent: 0,
    });
  }
  if (subs.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_devices", registered: 0, sent: 0 });
  }

  const sent = await sendPushToUser(user.id, {
    title: "🔔 Motiv test",
    body: "Notifications are working. This is what a nudge looks like.",
    url: "/chat",
  });

  return NextResponse.json({
    ok: sent > 0,
    reason: sent > 0 ? null : "send_failed",
    registered: subs.length,
    sent,
  });
});
