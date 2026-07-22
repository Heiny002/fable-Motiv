import Link from "next/link";
import { redirect } from "next/navigation";
import GoalCard from "@/components/GoalCard";
import { getCurrentUser } from "@/lib/auth";
import { computePowerStreak, getPowerTasksBetween, listGoalsWithPlans } from "@/lib/data";
import { userLocalDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const todayStr = userLocalDate(user.timezone, 0);
  const [goals, powerRecent] = await Promise.all([
    listGoalsWithPlans(user.id),
    getPowerTasksBetween(user.id, userLocalDate(user.timezone, -30), todayStr),
  ]);
  const streak = computePowerStreak(powerRecent, todayStr);
  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");
  const focusFirst = [...active].sort((a, b) => Number(b.is_focus) - Number(a.is_focus));

  return (
    <main className="px-4 py-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Your goals</h1>
          <p className="text-sm text-slate-500">Hi {user.name.split(" ")[0]} 👋</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm">
          <div className="text-xl font-extrabold text-orange-500">🔥 {streak}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            win streak
          </div>
        </div>
      </header>

      {focusFirst.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">🎯</p>
          <h2 className="mt-2 font-semibold">No goals yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your coach will interview you and build a Master Plan together with you.
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Talk to your coach
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {focusFirst.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>

      {completed.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Completed 🏆
          </h2>
          <div className="space-y-3 opacity-70">
            {completed.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </>
      )}

      {focusFirst.length > 0 && (
        <Link
          href="/chat"
          className="mt-6 block rounded-2xl border-2 border-dashed border-slate-200 py-4 text-center text-sm font-semibold text-slate-500 active:bg-slate-100"
        >
          + Start a new goal with your coach
        </Link>
      )}
    </main>
  );
}
