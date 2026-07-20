import ChatView from "@/components/ChatView";
import { getCurrentUser } from "@/lib/auth";
import { PERSONALITIES } from "@/lib/coach/prompt";
import type { CoachStyle } from "@/lib/types";

export default async function ChatPage() {
  const user = (await getCurrentUser())!;
  const label = PERSONALITIES[user.coach_style as CoachStyle]?.label ?? "Coach";
  return <ChatView coachLabel={label} />;
}
