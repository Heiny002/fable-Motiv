"use client";

import { useState } from "react";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else setSent(true);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  // Same message whether or not the email has an account — we never confirm either way.
  if (sent) {
    return (
      <p className="rounded-2xl bg-white p-4 text-[15px] leading-snug shadow-sm">
        Request sent. If that email has an account, they&apos;ve been notified — you&apos;ll get a reset
        link from them shortly.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoCapitalize="none"
        required
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 disabled:opacity-60 active:scale-[0.98]"
      >
        {busy ? "One sec…" : "Request a reset link"}
      </button>
    </form>
  );
}
