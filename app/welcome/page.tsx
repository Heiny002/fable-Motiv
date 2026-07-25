import { redirect } from "next/navigation";
import WelcomeFlow from "@/components/WelcomeFlow";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboarded) redirect("/chat");
  return <WelcomeFlow user={user} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />;
}
