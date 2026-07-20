import { redirect } from "next/navigation";
import CheckInForm from "@/components/CheckInForm";
import { getCurrentUser } from "@/lib/auth";
import { computeStreak, recentCheckIns } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const checkIns = await recentCheckIns(user.id);
  const streak = computeStreak(checkIns, user.timezone);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone });
  const doneToday = checkIns.some(
    (c) => new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: user.timezone }) === today
  );

  return (
    <main className="px-4 py-5">
      <h1 className="text-2xl font-extrabold">Daily check-in</h1>
      <p className="mb-5 text-sm text-slate-500">
        {doneToday ? "You already checked in today — another one never hurts." : "One minute of honesty keeps the streak alive."}
      </p>
      <CheckInForm initialStreak={streak} />

      {checkIns.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">History</h2>
          <ul className="space-y-2">
            {checkIns.slice(0, 10).map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <span>{["", "😞", "😕", "😐", "🙂", "🔥"][c.mood]}</span>
                </div>
                {c.note && <p className="mt-1 text-sm text-slate-700">{c.note}</p>}
                {c.coach_reply && (
                  <p className="mt-1.5 border-l-2 border-brand-200 pl-2 text-xs italic text-slate-500">
                    {c.coach_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
