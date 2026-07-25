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

const FEATURES: Array<{ icon: string; title: string; body: string }> = [
  { icon: "🎯", title: "Goals & Master Plan", body: "Your coach interviews you, then builds a living plan you shape together." },
  { icon: "🏁", title: "The Power List", body: "Up to 5 must-do tasks a day. Hit 100% to win the day and stack your streak." },
  { icon: "⏱", title: "Check-ins & timers", body: "The coach schedules nudges around your day — and runs timed exercises in chat." },
  { icon: "🔊", title: "Voice", body: "Tap to hear replies aloud, or let the coach read every message automatically." },
  { icon: "🧠", title: "Memory", body: "Motiv remembers what drives you, so coaching gets more personal over time." },
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

const TOTAL = 5;

type PushEnv = "ready" | "needs_install" | "unsupported";

/**
 * Whether this context can actually receive push. iOS only exposes push to a
 * PWA launched from the Home Screen — in a Safari tab the APIs are missing or
 * inert, so we tell the user to install first instead of letting them tap a
 * button that silently does nothing.
 */
function detectPushEnv(): PushEnv {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIOS && !standalone) return "needs_install";
  const hasPush =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return hasPush ? "ready" : "unsupported";
}

export default function WelcomeFlow({
  user,
  vapidKey,
  preview = false,
}: {
  user: PublicUser;
  vapidKey: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<CoachStyle>(user.coach_style);
  const [bedtime, setBedtime] = useState(user.bedtime ?? "");
  const [wakeTime, setWakeTime] = useState(user.wake_time ?? "");
  const [pushState, setPushState] = useState<"idle" | "on" | "denied" | "unsupported" | "error">(
    "idle"
  );
  const [finishing, setFinishing] = useState(false);
  const [pushEnv, setPushEnv] = useState<PushEnv | null>(null);

  useEffect(() => setPushEnv(detectPushEnv()), []);

  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function save(patch: Record<string, unknown>) {
    if (preview) return; // testing preview — never touch the backend
    await fetch("/api/v1/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  async function finish() {
    if (preview) {
      router.push("/settings");
      return;
    }
    setFinishing(true);
    await save({ onboarded: true, timezone: tz() });
    router.push("/chat");
    router.refresh();
  }

  async function enablePush() {
    if (preview) {
      // Show the success state without subscribing or saving anything.
      setPushState("on");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !vapidKey) {
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
      save({ timezone: tz() });
    } catch {
      setPushState("error");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-brand-600" : i < step ? "w-1.5 bg-brand-400" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
        <button onClick={finish} disabled={finishing} className="text-sm font-medium text-slate-400">
          {preview ? "Close" : "Skip"}
        </button>
      </div>

      {preview && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] font-medium text-amber-700">
          👀 Preview mode — nothing you tap here is saved
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col justify-center text-center">
            <div className="text-6xl">👋</div>
            <h1 className="mt-4 text-3xl font-extrabold">Welcome to Motiv, {user.name.split(" ")[0]}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              I&apos;m your AI coach. In the next minute we&apos;ll set up how I work with you — then
              we&apos;ll get to your first goal. Takes about 60 seconds, and you can skip anything.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-extrabold">Pick your coach&apos;s style</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">How should I push you? Change this anytime.</p>
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
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-extrabold">Set your daily rhythm</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              I&apos;ll nudge you at night to plan tomorrow, and in the morning to lock in your intention.
              Set these near when you actually sleep and wake.
            </p>
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <label className="flex items-center justify-between">
                <span className="text-[15px] font-medium">🌙 Bedtime</span>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => {
                    setBedtime(e.target.value);
                    save({ bedtime: e.target.value || null, timezone: tz() });
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-[15px] font-medium">☀️ Wake time</span>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => {
                    setWakeTime(e.target.value);
                    save({ wake_time: e.target.value || null, timezone: tz() });
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-extrabold">Stay on track with nudges</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Timed check-ins and daily rituals reach you through notifications. Turn them on so I can
              actually show up for you.
            </p>
            {pushEnv === "needs_install" && (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[13px] font-semibold text-amber-800">
                  📲 Push not supported here — add Motiv to your Home Screen first
                </p>
                <p className="mt-1.5 text-[12px] leading-snug text-amber-700">
                  On iPhone, notifications only work from the installed app. Tap{" "}
                  <span className="font-semibold">Share</span> →{" "}
                  <span className="font-semibold">Add to Home Screen</span>, open Motiv from your Home
                  Screen, then turn notifications on here or in Settings.
                </p>
              </div>
            )}
            {pushEnv === "unsupported" && (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[13px] font-semibold text-slate-700">
                  Push not supported here
                </p>
                <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
                  This browser can&apos;t receive notifications. Open Motiv in a supported browser, or
                  on your phone, to turn them on.
                </p>
              </div>
            )}
            <button
              onClick={enablePush}
              disabled={pushState === "on" || (!preview && pushEnv !== "ready")}
              className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pushState === "on"
                ? "Notifications enabled ✓"
                : pushState === "denied"
                  ? "Permission denied — enable in browser settings"
                  : pushEnv === "needs_install"
                    ? "Add to Home Screen to enable"
                    : pushEnv === "unsupported"
                      ? "Push not supported here"
                      : pushState === "error"
                        ? "Couldn't enable — try again from the installed app"
                        : "Enable notifications"}
            </button>
            <p className="mt-3 text-[12px] leading-snug text-slate-400">
              You can always turn these on later in Settings.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-extrabold">Here&apos;s what we&apos;ll do together</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">Everything Motiv gives you, in one glance.</p>
            <div className="space-y-2.5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm">
                  <span className="text-2xl">{f.icon}</span>
                  <span>
                    <span className="block text-[15px] font-semibold">{f.title}</span>
                    <span className="block text-xs leading-snug text-slate-500">{f.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-500"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < TOTAL - 1 ? (
          <button
            onClick={next}
            className="rounded-2xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98]"
          >
            {step === 0 ? "Let's go" : "Continue"}
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={finishing}
            className="rounded-2xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98] disabled:opacity-60"
          >
            {preview ? "Done →" : finishing ? "One sec…" : "Meet your coach →"}
          </button>
        )}
      </div>
    </main>
  );
}
