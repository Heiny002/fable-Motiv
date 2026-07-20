"use client";

import { useState } from "react";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export default function ShareSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["id"]>("instagram");
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setPost("");
    setCopied(false);
    try {
      const res = await fetch("/api/v1/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId, platform }),
      });
      const data = await res.json();
      setPost(res.ok ? data.post : "Couldn't generate a post right now — try again.");
    } catch {
      setPost("Couldn't generate a post right now — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyOrShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: post });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(post);
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <h2 className="text-lg font-bold">Share your journey</h2>
        <p className="text-sm text-slate-500">Your coach drafts it — you post it.</p>

        <div className="mt-4 flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                platform === p.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {post && (
          <textarea
            className="mt-4 h-40 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={generate}
            disabled={busy}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Writing…" : post ? "Regenerate" : "Generate post"}
          </button>
          {post && (
            <button
              onClick={copyOrShare}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
            >
              {copied ? "Copied ✓" : "Copy / Share"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
