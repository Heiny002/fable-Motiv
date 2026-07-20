"use client";

import { useState } from "react";

export interface ActiveEvent {
  id: string;
  kind: "timer" | "reminder" | "nudge";
  label: string;
  summary: string;
  fire_at: string;
}

function remaining(fireAt: string, now: number): string {
  const ms = new Date(fireAt).getTime() - now;
  if (ms <= 0) return "now";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.round(h / 24)}d`;
}

/** Clock icon + tap-to-open popup listing active timers/check-ins with live countdowns. */
export default function TimerBadge({
  events,
  now,
  onCancel,
}: {
  events: ActiveEvent[];
  now: number;
  onCancel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;

  const soonest = events[0];
  const timers = events.filter((e) => e.kind === "timer");
  // Show the soonest timer's countdown next to the clock; otherwise just a count.
  const chip = timers.length > 0 ? remaining(timers[0].fire_at, now) : `${events.length}`;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 active:scale-95"
        aria-label="Active timers and check-ins"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
        <span className="tabular-nums">{chip}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16" onClick={() => setOpen(false)}>
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Active check-ins</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400" aria-label="Close">
                ✕
              </button>
            </div>
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {e.kind === "timer" ? "⏱ " : "🎯 "}
                        {e.label}
                      </p>
                      {e.summary && <p className="mt-0.5 text-xs text-slate-500">{e.summary}</p>}
                    </div>
                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold tabular-nums text-brand-700 shadow-sm">
                      {remaining(e.fire_at, now)}
                    </span>
                  </div>
                  <button
                    onClick={() => onCancel(e.id)}
                    className="mt-2 text-xs font-medium text-red-500"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Your coach checks in automatically when each one ends.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
