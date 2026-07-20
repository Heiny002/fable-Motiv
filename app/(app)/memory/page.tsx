import Link from "next/link";
import { redirect } from "next/navigation";
import MemoryList from "@/components/MemoryList";
import { getCurrentUser } from "@/lib/auth";
import { listMemories } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memories = await listMemories(user.id);
  return (
    <main className="px-4 py-5">
      <Link href="/settings" className="text-sm font-medium text-brand-600">
        ← Settings
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold">Memory</h1>
      <p className="mb-5 text-sm text-slate-500">Everything your coach has learned about you.</p>
      <MemoryList memories={memories} />
    </main>
  );
}
