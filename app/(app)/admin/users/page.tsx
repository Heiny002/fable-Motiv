import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { adminUserActivity, type UserActivityRow } from "@/lib/data";
import { idleDays, stageForIdleDays, thresholds } from "@/lib/inactivity";

export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const d = idleDays(new Date(iso).getTime(), Date.now());
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/** What the coach is doing with this person right now, derived the same way the cron does. */
function status(u: UserActivityRow): { label: string; tone: string; detail: string } {
  const days = idleDays(new Date(u.last_active).getTime(), Date.now());
  const stage = stageForIdleDays(days, u.engaged);
  const t = thresholds(u.engaged);
  if (!u.engaged && days < t.reduce) {
    return { label: "Not started", tone: "bg-slate-100 text-slate-600", detail: "Hasn't sent a message or added a task yet" };
  }
  if (stage === 2) return { label: "Paused", tone: "bg-red-100 text-red-700", detail: `Quiet ${days} days — check-ins paused` };
  if (stage === 1) return { label: "Scaled back", tone: "bg-amber-100 text-amber-700", detail: `Quiet ${days} days — one check-in a day` };
  return { label: "Active", tone: "bg-green-100 text-green-700", detail: "Check-ins running normally" };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[15px] font-bold text-slate-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/settings");

  const rows = await adminUserActivity();

  return (
    <main className="space-y-4 px-4 py-5">
      <div>
        <Link href="/settings" className="text-xs font-semibold text-brand-600">
          ‹ Settings
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold">Users</h1>
        <p className="text-sm text-slate-500">
          Activity at a glance — counts and dates only. Message content isn&apos;t shown here.
        </p>
      </div>

      {rows.map((u) => {
        const s = status(u);
        return (
          <section key={u.user_id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-bold">
                  {u.name}
                  {u.email.toLowerCase() === user.email.toLowerCase() && (
                    <span className="ml-1.5 text-xs font-medium text-slate-400">(you)</span>
                  )}
                </h2>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.tone}`}>
                {s.label}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">{s.detail}</p>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <Stat label="Sent" value={u.msgs_sent} />
              <Stat label="Coach" value={u.coach_msgs} />
              <Stat label="Goals" value={u.goals} />
              <Stat label="Memories" value={u.memories} />
              <Stat label="Tasks" value={u.power_tasks} />
              <Stat label="Done" value={u.power_done} />
              <Stat label="AI 24h" value={u.ai_24h} />
              <Stat label="AI total" value={u.ai_total} />
            </div>

            <dl className="mt-3 space-y-1 text-[12px] text-slate-500">
              <div className="flex justify-between gap-3">
                <dt>Last did something</dt>
                <dd className="text-right font-medium text-slate-700">
                  {u.engaged ? ago(u.last_active) : "never"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Joined</dt>
                <dd className="text-right font-medium text-slate-700">{ago(u.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Notifications</dt>
                <dd className={`text-right font-medium ${u.push_devices ? "text-slate-700" : "text-amber-600"}`}>
                  {u.push_devices ? `${u.push_devices} device${u.push_devices === 1 ? "" : "s"}` : "none — can't receive pushes"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Coach style</dt>
                <dd className="text-right font-medium text-slate-700">{u.coach_style.replace("_", " ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Invite code</dt>
                <dd className="text-right font-medium text-slate-700">{u.invite_code ?? "— (joined before invites)"}</dd>
              </div>
              {!u.onboarded && (
                <div className="flex justify-between gap-3">
                  <dt>Onboarding</dt>
                  <dd className="text-right font-medium text-amber-600">not finished</dd>
                </div>
              )}
            </dl>
          </section>
        );
      })}
    </main>
  );
}
