"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TimerBadge, { type ActiveEvent } from "./TimerBadge";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatView({ coachLabel }: { coachLabel: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/coach/chat");
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch {
      /* keep existing */
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/events");
      const d = await r.json();
      setEvents(d.events ?? []);
    } catch {
      /* keep existing */
    }
  }, []);

  useEffect(() => {
    Promise.all([loadHistory(), loadEvents()]).finally(() => setLoaded(true));
  }, [loadHistory, loadEvents]);

  // Tick a clock once per second for live countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fire-on-zero: when a timer elapses and the app is visible, ask the server to
  // debrief immediately (the cron sweeper is the backstop for the locked-phone case).
  useEffect(() => {
    if (busy) return;
    const due = events.filter(
      (e) => new Date(e.fire_at).getTime() <= now && !firedRef.current.has(e.id)
    );
    if (due.length === 0) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    (async () => {
      for (const e of due) {
        firedRef.current.add(e.id);
        try {
          await fetch(`/api/v1/events/${e.id}/fire`, { method: "POST" });
        } catch {
          /* cron will still fire it */
        }
      }
      await Promise.all([loadHistory(), loadEvents()]);
    })();
  }, [now, events, busy, loadHistory, loadEvents]);

  async function cancelEvent(id: string) {
    setEvents((list) => list.filter((e) => e.id !== id));
    try {
      await fetch(`/api/v1/events/${id}`, { method: "DELETE" });
    } catch {
      loadEvents();
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: text },
      { id: `a-${Date.now()}`, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/v1/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error("request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; text?: string };
            if (event.type === "text" && event.text) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, content: last.content + event.text };
                return copy;
              });
            } else if (event.type === "refresh") {
              // Coach mutated state (maybe started a timer) — refresh the badge.
              loadEvents();
            }
          } catch {
            // skip malformed frame
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last.role === "assistant" && !last.content) {
          copy[copy.length - 1] = {
            ...last,
            content: "Hmm, I couldn't respond just now. Try again in a moment.",
          };
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">
          Motiv <span className="text-xs font-medium text-slate-400">· {coachLabel}</span>
        </h1>
        <TimerBadge events={events} now={now} onCancel={cancelEvent} />
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        {!loaded && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[15px] text-slate-800 shadow-sm"
              }
            >
              {m.content || (busy ? <span className="animate-pulse">•••</span> : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-20 border-t border-slate-200 bg-white px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-32 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] outline-none focus:border-brand-500"
            rows={1}
            placeholder="Talk to your coach…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="rounded-full bg-brand-600 p-3 text-white shadow disabled:opacity-40 active:scale-95"
            aria-label="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
