"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GoalWithPlan, PlanItem } from "@/lib/types";
import ShareSheet from "./ShareSheet";

export default function PlanView({ goal }: { goal: GoalWithPlan }) {
  const router = useRouter();
  const [items, setItems] = useState<PlanItem[]>(goal.plan_items);
  const [share, setShare] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const done = items.filter((i) => i.completed).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function toggle(item: PlanItem) {
    const next = !item.completed;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, completed: next } : i)));
    if (next && item.kind === "milestone") {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2200);
    }
    const res = await fetch(`/api/v1/plan-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    if (!res.ok) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, completed: !next } : i)));
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-bounce rounded-3xl bg-white/95 px-8 py-6 text-center shadow-2xl">
            <div className="text-5xl">🎉</div>
            <p className="mt-2 font-bold">Milestone crushed!</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{pct}% complete</span>
          <span className="text-slate-400">
            {done}/{items.length}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {goal.master_plan_summary && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{goal.master_plan_summary}</p>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => toggle(item)}
              className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left shadow-sm transition-colors ${
                item.completed ? "bg-brand-50/60" : "bg-white"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  item.completed
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-300 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[15px] font-medium ${
                    item.completed ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {item.kind === "milestone" && <span className="mr-1">🏁</span>}
                  {item.title}
                </span>
                {item.detail && <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>}
                {item.due_date && (
                  <span className="mt-0.5 block text-[11px] text-slate-400">Due {item.due_date}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setShare(true)}
        className="mt-5 w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 shadow-sm active:scale-[0.99]"
      >
        📣 Share my progress
      </button>
      {share && <ShareSheet goalId={goal.id} onClose={() => setShare(false)} />}
    </div>
  );
}
