"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-sm font-medium text-red-600">This reset link is missing its token. Ask for a new one.</p>;
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-white p-4 text-[15px] shadow-sm">Password updated. You can log in now.</p>
        <Link
          href="/login"
          className="block w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-brand-600/30"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        type="password"
        placeholder="New password (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 disabled:opacity-60 active:scale-[0.98]"
      >
        {busy ? "One sec…" : "Set new password"}
      </button>
    </form>
  );
}
