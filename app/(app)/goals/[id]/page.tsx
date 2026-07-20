import Link from "next/link";
import { notFound } from "next/navigation";
import PlanView from "@/components/PlanView";
import { getCurrentUser } from "@/lib/auth";
import { getGoal } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const goal = await getGoal(user.id, params.id);
  if (!goal) notFound();

  return (
    <main className="px-4 py-5">
      <Link href="/dashboard" className="text-sm font-medium text-brand-600">
        ← Goals
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight">{goal.title}</h1>
      {goal.description && <p className="mt-1 text-sm text-slate-500">{goal.description}</p>}
      {goal.target_date && (
        <p className="mt-1 text-xs font-medium text-slate-400">Target: {goal.target_date}</p>
      )}
      <div className="mt-4">
        <PlanView goal={goal} />
      </div>
    </main>
  );
}
