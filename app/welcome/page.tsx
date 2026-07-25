import { redirect } from "next/navigation";
import WelcomeFlow from "@/components/WelcomeFlow";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: { preview?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preview = searchParams.preview === "1";
  // Real onboarding shows once; preview mode lets an onboarded user re-watch it.
  if (user.onboarded && !preview) redirect("/chat");
  return (
    <WelcomeFlow
      user={user}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      preview={preview}
    />
  );
}
