"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Memory } from "@/lib/types";

const BUCKETS: Array<{ kind: Memory["kind"]; label: string; blurb: string; emoji: string }> = [
  { kind: "biographical", label: "About you", blurb: "Who you are, your constraints and schedule", emoji: "👤" },
  { kind: "goal", label: "About your goals", blurb: "Context on what you're working toward", emoji: "🎯" },
  { kind: "history", label: "Patterns & history", blurb: "Past attempts and tendencies", emoji: "🧭" },
];

export default function MemoryList({ memories }: { memories: Memory[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Memory[]>(memories);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    setItems((list) => list.filter((m) => m.id !== id));
    try {
      await fetch(`/api/v1/memories/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
        What Motiv remembers
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Your coach saves durable facts so it doesn&apos;t re-ask. Remove anything that&apos;s wrong or
        outdated.
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
          Nothing saved yet. As you chat, your coach will remember key facts here.
        </div>
      ) : (
        <div className="space-y-4">
          {BUCKETS.map((bucket) => {
            const inBucket = items.filter((m) => m.kind === bucket.kind);
            if (inBucket.length === 0) return null;
            return (
              <div key={bucket.kind}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span>{bucket.emoji}</span>
                  <span className="text-sm font-semibold text-slate-700">{bucket.label}</span>
                  <span className="text-[11px] text-slate-400">{inBucket.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {inBucket.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-2 rounded-xl bg-white p-3 shadow-sm"
                    >
                      <span className="text-sm text-slate-700">{m.content}</span>
                      <button
                        onClick={() => remove(m.id)}
                        disabled={busy === m.id}
                        className="mt-0.5 shrink-0 rounded-md px-1.5 text-slate-300 hover:text-red-500 disabled:opacity-40"
                        aria-label="Forget this"
                        title="Forget this"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
