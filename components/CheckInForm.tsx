"use client";

import { useState } from "react";

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "🔥", label: "Crushing it" },
];

export default function CheckInForm({ initialStreak }: { initialStreak: number }) {
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [streak, setStreak] = useState(initialStreak);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (mood === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setReply(data.checkin.coach_reply);
      setStreak(data.streak);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  if (reply) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <div className="text-4xl">🔥</div>
          <p className="mt-1 text-2xl font-extrabold">{streak}-day streak</p>
          <p className="text-sm text-slate-500">Check-in logged. See you tomorrow.</p>
        </div>
        <div className="rounded-2xl bg-brand-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Your coach</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{reply}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 font-semibold">How did today go?</p>
        <div className="flex justify-between gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-3 transition ${
                mood === m.value ? "bg-brand-600 text-white shadow-lg" : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] font-medium">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <textarea
        className="h-28 w-full rounded-2xl border border-slate-200 bg-white p-4 text-[15px] shadow-sm outline-none focus:border-brand-500"
        placeholder="What happened today? Wins, obstacles, excuses — your coach wants the truth."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={mood === null || busy}
        className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 disabled:opacity-50 active:scale-[0.98]"
      >
        {busy ? "Sending to your coach…" : "Check in"}
      </button>
    </div>
  );
}
