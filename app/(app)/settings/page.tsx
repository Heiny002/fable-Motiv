import Link from "next/link";
import { redirect } from "next/navigation";
import AdminTools from "@/components/AdminTools";
import SettingsForm from "@/components/SettingsForm";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { listMemories, listPendingResetRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memories = await listMemories(user.id);
  const resetRequests = isAdmin(user.email) ? await listPendingResetRequests() : [];
  return (
    <main className="space-y-6 px-4 py-5">
      <div>
        <h1 className="mb-1 text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>
      <SettingsForm user={user} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <Link
        href="/memory"
        className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <span>
            <span className="block text-[15px] font-semibold">What Motiv remembers</span>
            <span className="block text-xs text-slate-500">
              {memories.length} saved {memories.length === 1 ? "memory" : "memories"} · view &amp; manage
            </span>
          </span>
        </span>
        <span className="text-slate-300">›</span>
      </Link>

      {isAdmin(user.email) && (
        <Link
          href="/welcome?preview=1"
          className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white p-4 active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <span>
              <span className="block text-[15px] font-semibold">Preview onboarding</span>
              <span className="block text-xs text-slate-500">
                Walk the new-user flow · admin, nothing saves
              </span>
            </span>
          </span>
          <span className="text-slate-300">›</span>
        </Link>
      )}
      {isAdmin(user.email) && (
        <Link
          href="/admin/users"
          className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white p-4 active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <span>
              <span className="block text-[15px] font-semibold">Users</span>
              <span className="block text-xs text-slate-500">
                See who&apos;s active, who&apos;s gone quiet · admin
              </span>
            </span>
          </span>
          <span className="text-slate-300">›</span>
        </Link>
      )}
      {isAdmin(user.email) && <AdminTools requests={resetRequests} />}
    </main>
  );
}
