"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PowerTask } from "@/lib/types";

interface DayList {
  date: string;
  tasks: PowerTask[];
}

function fmtDate(iso: string): string {
  // iso is YYYY-MM-DD (local). Parse as local, not UTC.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function TodayView() {
  const [today, setToday] = useState<DayList | null>(null);
  const [tomorrow, setTomorrow] = useState<DayList | null>(null);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [addingToday, setAddingToday] = useState("");
  const [addingTomorrow, setAddingTomorrow] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/v1/power");
      const d = await r.json();
      setToday(d.today);
      setTomorrow(d.tomorrow);
      setStreak(d.streak ?? 0);
    } catch {
      /* keep */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const todayTasks = today?.tasks ?? [];
  const done = todayTasks.filter((t) => t.completed).length;
  const total = todayTasks.length;
  const won = total > 0 && done === total;

  async function toggle(task: PowerTask, list: "today" | "tomorrow") {
    const next = !task.completed;
    const setter = list === "today" ? setToday : setTomorrow;
    setter((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, completed: next } : t)) } : d
    );
    if (list === "today") {
      const nowDone = todayTasks.map((t) => (t.id === task.id ? next : t.completed)).filter(Boolean).length;
      if (next && total > 0 && nowDone === total) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2600);
      }
    }
    const res = await fetch(`/api/v1/power/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    if (!res.ok) load();
    else if (list === "today") load(); // refresh streak
  }

  async function add(day: "today" | "tomorrow") {
    const title = (day === "today" ? addingToday : addingTomorrow).trim();
    if (!title) return;
    if (day === "today") setAddingToday("");
    else setAddingTomorrow("");
    const res = await fetch("/api/v1/power/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, title }),
    });
    if (res.ok) load();
  }

  async function remove(task: PowerTask) {
    setToday((d) => (d ? { ...d, tasks: d.tasks.filter((t) => t.id !== task.id) } : d));
    setTomorrow((d) => (d ? { ...d, tasks: d.tasks.filter((t) => t.id !== task.id) } : d));
    await fetch(`/api/v1/power/tasks/${task.id}`, { method: "DELETE" });
    load();
  }

  function List({ day, list }: { day: "today" | "tomorrow"; list: DayList | null }) {
    const tasks = list?.tasks ?? [];
    const adding = day === "today" ? addingToday : addingTomorrow;
    const setAdding = day === "today" ? setAddingToday : setAddingTomorrow;
    return (
      <>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2">
              <button
                onClick={() => toggle(task, day)}
                className={`flex flex-1 items-center gap-3 rounded-2xl p-3.5 text-left shadow-sm ${
                  task.completed ? "bg-brand-50/70" : "bg-white"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    task.completed ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={`text-[15px] ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {task.title}
                </span>
              </button>
              <button onClick={() => remove(task)} className="px-1 text-slate-300 hover:text-red-500" aria-label="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {tasks.length < 5 && (
          <div className="mt-2 flex gap-2">
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add(day)}
              placeholder={tasks.length === 0 ? "Add your first task…" : "Add a task…"}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              maxLength={200}
            />
            <button
              onClick={() => add(day)}
              disabled={!adding.trim()}
              className="rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
        {tasks.length >= 5 && <p className="mt-2 text-center text-[11px] text-slate-400">5 is the max — keep it focused.</p>}
      </>
    );
  }

  if (!loaded) return <p className="py-16 text-center text-sm text-slate-400">Loading…</p>;

  return (
    <main className="px-4 py-5">
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-bounce rounded-3xl bg-white/95 px-8 py-6 text-center shadow-2xl">
            <div className="text-5xl">🏆</div>
            <p className="mt-2 text-lg font-extrabold">You won the day!</p>
          </div>
        </div>
      )}

      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Today</h1>
          <p className="text-sm text-slate-500">{today ? fmtDate(today.date) : ""}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm">
          <div className="text-xl font-extrabold text-orange-500">🔥 {streak}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">win streak</div>
        </div>
      </header>

      <div className={`mb-4 rounded-2xl p-4 shadow-sm ${won ? "bg-brand-600 text-white" : "bg-white"}`}>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{won ? "🏆 Day won — 100%!" : "Win the day"}</span>
          <span className={won ? "text-brand-100" : "text-slate-400"}>
            {done}/{total || 0}
          </span>
        </div>
        <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${won ? "bg-brand-500" : "bg-slate-100"}`}>
          <div
            className={`h-full rounded-full transition-all ${won ? "bg-white" : "bg-brand-500"}`}
            style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <List day="today" list={today} />

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tomorrow{tomorrow ? ` · ${fmtDate(tomorrow.date)}` : ""}
          </h2>
          <Link href="/chat" className="text-xs font-semibold text-brand-600">
            Plan with coach →
          </Link>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Set tomorrow&apos;s plan tonight — the evening ritual. Aim for a list you can win.
        </p>
        <List day="tomorrow" list={tomorrow} />
      </section>
    </main>
  );
}
