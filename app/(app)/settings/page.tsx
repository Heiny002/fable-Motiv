import { redirect } from "next/navigation";
import SettingsForm from "@/components/SettingsForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="px-4 py-5">
      <h1 className="mb-1 text-2xl font-extrabold">Settings</h1>
      <p className="mb-5 text-sm text-slate-500">{user.email}</p>
      <SettingsForm user={user} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
    </main>
  );
}
