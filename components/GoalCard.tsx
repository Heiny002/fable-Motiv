"use client";

import Link from "next/link";
import type { GoalWithPlan } from "@/lib/types";

export default function GoalCard({ goal }: { goal: GoalWithPlan }) {
  const done = goal.plan_items.filter((i) => i.completed).length;
  const total = goal.plan_items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const nextItem = goal.plan_items.find((i) => !i.completed);

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{goal.title}</h3>
        {goal.is_focus && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            FOCUS
          </span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {done}/{total} done · {pct}%
        </span>
        {goal.target_date && <span>🗓 {goal.target_date}</span>}
      </div>
      {nextItem && (
        <p className="mt-2 truncate text-sm text-slate-600">
          <span className="font-medium text-slate-400">Next:</span> {nextItem.title}
        </p>
      )}
    </Link>
  );
}
