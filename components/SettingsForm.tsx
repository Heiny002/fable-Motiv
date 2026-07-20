"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CoachStyle, PublicUser } from "@/lib/types";

const STYLES: Array<{ id: CoachStyle; label: string; blurb: string; emoji: string }> = [
  { id: "gentle", label: "Gentle Encourager", blurb: "Warm, patient, zero pressure", emoji: "🌱" },
  { id: "supportive", label: "Supportive Coach", blurb: "Encouraging but honest", emoji: "🤝" },
  { id: "challenging", label: "Challenging Coach", blurb: "Direct, demanding, no excuses", emoji: "🏋️" },
  { id: "drill_sergeant", label: "Drill Sergeant", blurb: "Intense. Blunt. Relentless.", emoji: "🪖" },
];

// iOS Safari requires the VAPID key as a Uint8Array, not a base64 string.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function SettingsForm({ user, vapidKey }: { user: PublicUser; vapidKey: string }) {
  const router = useRouter();
  const [style, setStyle] = useState<CoachStyle>(user.coach_style);
  const [profanity, setProfanity] = useState(user.allow_profanity);
  const [hour, setHour] = useState(user.checkin_hour);
  const [saved, setSaved] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "on" | "unsupported" | "denied" | "error">(
    "idle"
  );

  // Reflect the *actual* notification state on load (the button used to always
  // reappear as "Enable" after a refresh). Self-heal: if the browser already has
  // a subscription, re-register it with the server so it can't drift out of sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    if (Notification.permission !== "granted") return; // stay "idle" → shows Enable
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return;
        setPushState("on");
        const json = sub.toJSON();
        await fetch("/api/v1/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  async function save(patch: Record<string, unknown>) {
    setSaved(false);
    const res = await fetch("/api/v1/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    }
  }

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) {
      setPushState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const json = subscription.toJSON();
      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("save failed");
      setPushState("on");
      // Sync the browser timezone so scheduled pushes arrive at the right local hour.
      save({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, checkin_hour: hour });
    } catch {
      setPushState("error");
    }
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Coach personality
        </h2>
        <div className="space-y-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStyle(s.id);
                save({ coach_style: s.id });
              }}
              className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left shadow-sm ${
                style === s.id ? "bg-brand-600 text-white" : "bg-white"
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span>
                <span className="block text-[15px] font-semibold">{s.label}</span>
                <span className={`block text-xs ${style === s.id ? "text-brand-100" : "text-slate-500"}`}>
                  {s.blurb}
                </span>
              </span>
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-sm">
          <span className="text-[15px] font-medium">
            Allow profanity <span className="text-xs text-slate-400">(drill sergeant mode 🤬)</span>
          </span>
          <input
            type="checkbox"
            checked={profanity}
            onChange={(e) => {
              setProfanity(e.target.checked);
              save({ allow_profanity: e.target.checked });
            }}
            className="h-5 w-5 accent-brand-600"
          />
        </label>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Daily check-in reminder
        </h2>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <label className="flex items-center justify-between">
            <span className="text-[15px] font-medium">Remind me at</span>
            <select
              value={hour}
              onChange={(e) => {
                const h = parseInt(e.target.value, 10);
                setHour(h);
                save({
                  checkin_hour: h,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={enablePush}
            className="mt-3 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={pushState === "on"}
          >
            {pushState === "on"
              ? "Notifications enabled ✓"
              : pushState === "denied"
                ? "Permission denied — enable in browser settings"
                : pushState === "unsupported"
                  ? "Push not supported here"
                  : pushState === "error"
                    ? "Couldn't enable — install to Home Screen first, then retry"
                    : "Enable push notifications"}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            On iPhone: add Motiv.ai to your Home Screen first (Share → Add to Home Screen), then enable
            notifications from the installed app.
          </p>
        </div>
      </section>

      {saved && <p className="text-center text-sm font-medium text-green-600">Saved ✓</p>}

      <button
        onClick={logout}
        className="w-full rounded-2xl border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600"
      >
        Log out
      </button>
    </div>
  );
}
