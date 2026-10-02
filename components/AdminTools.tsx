"use client";

import { useState } from "react";

export default function AdminTools() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/admin/reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else setResult(data);
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
      <form onSubmit={generate} className="flex gap-2">
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
