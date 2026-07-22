"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/lib/speech";
import TimerBadge, { type ActiveEvent } from "./TimerBadge";

interface Msg {
  id: string;
  role: "user" | "assistant" | "memory";
  content: string;
  memKind?: string;
}

const MEM_LABEL: Record<string, string> = {
  biographical: "About you",
  goal: "Goal context",
  history: "Pattern",
};

export default function ChatView({ coachLabel }: { coachLabel: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const speech = useSpeech();

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
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              memory?: { kind: string; content: string };
            };
            if (event.type === "text" && event.text) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, content: last.content + event.text };
                return copy;
              });
            } else if (event.type === "memory" && event.memory) {
              // Live indicator: insert a chip just above the streaming reply.
              const mem = event.memory;
              setMessages((m) => {
                const chip: Msg = {
                  id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  role: "memory",
                  content: mem.content,
                  memKind: mem.kind,
                };
                const copy = [...m];
                const insertAt = copy.length > 0 && copy[copy.length - 1].role === "assistant"
                  ? copy.length - 1
                  : copy.length;
                copy.splice(insertAt, 0, chip);
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
      if (speech.autoSpeak) {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last?.role === "assistant" && last.content) speech.speak(last.content, last.id);
          return m;
        });
      }
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">
          Motiv <span className="text-xs font-medium text-slate-400">· {coachLabel}</span>
        </h1>
        <div className="flex items-center gap-1.5">
          {speech.supported && (
            <button
              onClick={speech.toggleAutoSpeak}
              className={`rounded-full p-2 ${
                speech.autoSpeak ? "bg-brand-50 text-brand-600" : "text-slate-400"
              }`}
              aria-label={speech.autoSpeak ? "Turn off auto voice" : "Read replies aloud"}
              title={speech.autoSpeak ? "Auto voice on" : "Auto voice off"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {speech.autoSpeak ? (
                  <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12zM14 3.23v2.06a7 7 0 010 13.42v2.06a9 9 0 000-17.54z" />
                ) : (
                  <path d="M3 10v4h4l5 5V5L7 10H3zm16.59 1L22 8.59 20.59 7 18 9.59 15.41 7 14 8.59 16.59 11 14 13.41 15.41 15 18 12.41 20.59 15 22 13.41 19.59 11z" />
                )}
              </svg>
            </button>
          )}
          <TimerBadge events={events} now={now} onCancel={cancelEvent} />
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        {!loaded && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
        {messages.map((m) =>
          m.role === "memory" ? (
            <div key={m.id} className="flex justify-center">
              <div className="flex max-w-[90%] items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                <span aria-hidden>📝</span>
                <span className="font-semibold">
                  {MEM_LABEL[m.memKind ?? ""] ?? "Remembered"}:
                </span>
                <span className="truncate">{m.content}</span>
              </div>
            </div>
          ) : (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[15px] text-slate-800 shadow-sm"
              }
            >
              {m.content || (busy ? <span className="animate-pulse">•••</span> : "")}
            </div>
            {m.role === "assistant" && m.content && speech.supported && (
              <button
                onClick={() => speech.speak(m.content, m.id)}
                className={`mt-1 ml-1 flex items-center gap-1 text-[11px] font-medium ${
                  speech.speakingId === m.id ? "text-brand-600" : "text-slate-400"
                }`}
                aria-label={speech.speakingId === m.id ? "Stop" : "Play aloud"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  {speech.speakingId === m.id ? (
                    <path d="M6 6h12v12H6z" />
                  ) : (
                    <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                  )}
                </svg>
                {speech.speakingId === m.id ? "Stop" : "Listen"}
              </button>
            )}
          </div>
          )
        )}
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
