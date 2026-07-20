import webpush from "web-push";
import { deletePushSubscription, listPushSubscriptions } from "./data";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:coach@motiv.ai", pub, priv);
  configured = true;
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await listPushSubscriptions(userId);
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await deletePushSubscription(sub.endpoint);
      }
    })
  );
  return sent;
}
