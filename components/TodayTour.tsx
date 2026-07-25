"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "motiv_today_tour_v1";

const STEPS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "🏁",
    title: "Meet your Power List",
    body: "Each day gets up to 5 must-do tasks — your daily action plan. Finish 100% of them and you win the day. That's the whole game.",
  },
  {
    icon: "🔥",
    title: "Win the day, stack the streak",
    body: "The bar up top tracks today's progress; the flame is your win streak. Every 100% day adds one. Miss a day and it resets — so keep the list winnable.",
  },
  {
    icon: "🌙",
    title: "Plan tomorrow tonight",
    body: "Each evening you and your coach review today and build tomorrow's list — talking through rough timing so the coach can check in around your key tasks. Anything unfinished carries over.",
  },
  {
    icon: "⏰",
    title: "Set your two times",
    body: "In Settings, set a bedtime and a wake time. Your coach nudges you at night to plan, and in the morning to lock in your intention. That's the ritual.",
  },
];

export default function TodayTour() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(KEY)) setShow(true);
  }, []);

  function close() {
    if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    setShow(false);
  }

  if (!show) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-5xl">{s.icon}</div>
          <h2 className="mt-3 text-lg font-extrabold">{s.title}</h2>
          <p className="mt-2 text-[15px] leading-snug text-slate-600">{s.body}</p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button onClick={close} className="px-2 py-2 text-sm font-medium text-slate-400">
            Skip
          </button>
          <div className="flex-1" />
          {step > 0 && (
            <button
              onClick={() => setStep((n) => n - 1)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Back
            </button>
          )}
          {last ? (
            <Link
              href="/chat"
              onClick={close}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Plan with coach →
            </Link>
          ) : (
            <button
              onClick={() => setStep((n) => n + 1)}
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
