import { redirect } from "next/navigation";
import TodayView from "@/components/TodayView";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TodayView />;
}
