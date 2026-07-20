import { computeStreak, listGoalsWithPlans, recentCheckIns } from "../data";
import type { PublicUser } from "../types";
import { PERSONALITIES } from "./prompt";
import { anthropicClient, COACH_MODEL } from "./engine";

/** Generate the coach's reply to a daily check-in (single non-streaming call). */
export async function checkInReply(
  user: PublicUser,
  input: { mood: number; note: string }
): Promise<string> {
  const [goals, checkIns] = await Promise.all([
    listGoalsWithPlans(user.id),
    recentCheckIns(user.id),
  ]);
  const streak = computeStreak(checkIns, user.timezone);
  const focus = goals.find((g) => g.is_focus && g.status === "active") ?? goals[0];
  const done = focus ? focus.plan_items.filter((i) => i.completed).length : 0;
  const total = focus ? focus.plan_items.length : 0;

  const client = anthropicClient();
  if (!client) return fallbackReply(user, input.mood, streak, done, total);

  const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;
  const response = await client.messages.create({
    model: COACH_MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: `You are Motiv, ${user.name}'s AI goal coach (${personality.label}). ${personality.voice} ${
      user.allow_profanity ? "Mild profanity is allowed if it fits your style." : "Never use profanity."
    } Reply to the user's daily check-in in 2-4 sentences. Be concrete: react to their note and mood, reference their streak and progress, and end with one specific nudge for tomorrow. No lists, no headers.`,
    messages: [
      {
        role: "user",
        content: `Check-in:\nGoal: ${focus?.title ?? "(no goal yet)"}\nPlan progress: ${done}/${total} items done\nStreak: ${streak} days\nMood (1-5): ${input.mood}\nNote: ${input.note || "(none)"}\nRecent check-ins: ${checkIns
          .slice(0, 5)
          .map((c) => `${c.created_at.slice(0, 10)} mood ${c.mood}`)
          .join(", ") || "(first one!)"}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return fallbackReply(user, input.mood, streak, done, total);
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" && text.text.trim()
    ? text.text.trim()
    : fallbackReply(user, input.mood, streak, done, total);
}

function fallbackReply(
  user: PublicUser,
  mood: number,
  streak: number,
  done: number,
  total: number
): string {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const tough = user.coach_style === "challenging" || user.coach_style === "drill_sergeant";
  if (tough) {
    return mood >= 4
      ? `Good. ${streak}-day streak, ${pct}% through the plan. Don't get comfortable — hit the next item tomorrow before anything else.`
      : `Rough day noted. The streak is ${streak} days and the goal doesn't care how you feel. One small piece of the plan tomorrow — no zero days.`;
  }
  return mood >= 4
    ? `Love it — that's ${streak} day(s) in a row, and you're ${pct}% through your plan. Ride the momentum: pick one small piece for tomorrow.`
    : `Thanks for showing up even on a hard day — that's exactly how streaks like your ${streak}-day one get built. Tomorrow, just aim for one tiny win.`;
}
