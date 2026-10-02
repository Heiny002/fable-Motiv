"use client";

import { useState } from "react";

interface PendingRequest {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function AdminTools({ requests = [] }: { requests?: PendingRequest[] }) {
  const [pending, setPending] = useState<PendingRequest[]>(requests);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent | null, target?: string) {
    e?.preventDefault();
    const address = (target ?? email).trim();
    if (!address) return;
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/admin/reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else {
        setResult(data);
        // Issuing a link settles any open request from that person.
        setPending((list) => list.filter((r) => r.email.toLowerCase() !== address.toLowerCase()));
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      /* the link is still shown for manual copy */
    }
  }

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
      <h2 className="text-[15px] font-semibold">🔑 Reset a user&apos;s password</h2>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">
        Generates a one-time link that works for 1 hour. Send it to them yourself.
      </p>
      {pending.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            Waiting on you ({pending.length})
          </p>
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2"
            >
              <span className="min-w-0 text-xs">
                <span className="block truncate font-semibold text-slate-800">{r.name}</span>
                <span className="block truncate text-slate-500">
                  {r.email} ·{" "}
                  {new Date(r.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
              <button
                onClick={() => generate(null, r.email)}
                disabled={busy}
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Create link
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={(e) => generate(e)} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
          autoCapitalize="none"
          required
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Create"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Link for {result.name} · expires{" "}
            {new Date(result.expires_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="mt-1 break-all text-[11px] text-slate-700">{result.url}</p>
          <button onClick={copy} className="mt-2 text-xs font-semibold text-brand-600">
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </section>
  );
}
