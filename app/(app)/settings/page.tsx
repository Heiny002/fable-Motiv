import { redirect } from "next/navigation";
import MemoryList from "@/components/MemoryList";
import SettingsForm from "@/components/SettingsForm";
import { getCurrentUser } from "@/lib/auth";
import { listMemories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memories = await listMemories(user.id);
  return (
    <main className="space-y-6 px-4 py-5">
      <div>
        <h1 className="mb-1 text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>
      <SettingsForm user={user} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <MemoryList memories={memories} />
    </main>
  );
}
