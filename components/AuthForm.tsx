"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "signup" ? "/api/v1/auth/register" : "/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/chat");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" && (
        <input
          className={input}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      )}
      <input
        className={input}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <input
        className={input}
        type="password"
        placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        minLength={mode === "signup" ? 8 : undefined}
        required
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 disabled:opacity-60 active:scale-[0.98]"
      >
        {busy ? "One sec…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
