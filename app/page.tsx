import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-10">
      <div className="pt-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-4xl shadow-lg shadow-brand-600/30">
          🎯
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Motiv<span className="text-brand-600">.ai</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          An AI coach that helps you set the right goal, builds a real plan with you, and then{" "}
          <span className="font-semibold text-slate-900">holds you to it</span> — every single day.
        </p>
        <ul className="mt-8 space-y-3 text-left text-sm text-slate-600">
          <li className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-lg">💬</span>
            Your coach interviews you and drafts a Master Plan you agree on together.
          </li>
          <li className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-lg">🔥</span>
            Daily check-ins, streaks, and milestone celebrations keep you moving.
          </li>
          <li className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-lg">🎚️</span>
            Pick your coach&apos;s intensity — from Gentle Encourager to Drill Sergeant.
          </li>
        </ul>
      </div>
      <div className="space-y-3 pb-4">
        <Link
          href="/signup"
          className="block w-full rounded-2xl bg-brand-600 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98]"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="block w-full rounded-2xl border border-slate-200 bg-white py-4 text-center text-lg font-semibold text-slate-700 active:scale-[0.98]"
        >
          I have an account
        </Link>
      </div>
    </main>
  );
}
