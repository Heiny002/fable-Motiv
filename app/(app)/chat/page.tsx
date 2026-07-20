import { redirect } from "next/navigation";
import ChatView from "@/components/ChatView";
import { getCurrentUser } from "@/lib/auth";
import { PERSONALITIES } from "@/lib/coach/prompt";
import type { CoachStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const label = PERSONALITIES[user.coach_style as CoachStyle]?.label ?? "Coach";
  return <ChatView coachLabel={label} />;
}
