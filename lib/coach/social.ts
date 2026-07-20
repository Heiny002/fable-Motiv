import type { GoalWithPlan, PublicUser } from "../types";
import { PERSONALITIES } from "./prompt";
import { anthropicClient, COACH_MODEL } from "./engine";

export type SocialPlatform = "instagram" | "x" | "linkedin";

const PLATFORM_GUIDE: Record<SocialPlatform, string> = {
  instagram:
    "Instagram caption: personal and visual, 2-4 short paragraphs, 3-5 relevant hashtags at the end. Start the first line with a photo idea in [brackets].",
  x: "X (Twitter) post: under 280 characters, punchy, at most 2 hashtags.",
  linkedin:
    "LinkedIn post: professional but personal, 3-5 short paragraphs, frame the journey as growth/learning, max 3 hashtags.",
};

export async function generateSocialPost(
  user: PublicUser,
  goal: GoalWithPlan,
  platform: SocialPlatform
): Promise<string> {
  const done = goal.plan_items.filter((i) => i.completed).length;
  const total = goal.plan_items.length;
  const milestones = goal.plan_items
    .filter((i) => i.kind === "milestone" && i.completed)
    .map((i) => i.title);

  const client = anthropicClient();
  if (!client) return fallbackPost(goal.title, done, total, platform);

  const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;
  const response = await client.messages.create({
    model: COACH_MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: `You ghost-write social media posts in the USER's first-person voice about their goal journey (their coach is a ${personality.label}, but the post is the user's voice, authentic and human — include real struggle, not just highlights). Output ONLY the post text, ready to copy. No preamble, no surrounding quotes.`,
    messages: [
      {
        role: "user",
        content: `Write a post about my goal journey.\nGoal: ${goal.title}\nWhy it matters: ${goal.description || "(not stated)"}\nProgress: ${done}/${total} plan items done.\nMilestones hit: ${milestones.join(", ") || "none yet"}\nFormat: ${PLATFORM_GUIDE[platform]}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return fallbackPost(goal.title, done, total, platform);
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" && text.text.trim()
    ? text.text.trim()
    : fallbackPost(goal.title, done, total, platform);
}

function fallbackPost(title: string, done: number, total: number, platform: SocialPlatform): string {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const base = `Working toward my goal: ${title}. ${done}/${total} steps done (${pct}%). Showing up beats being perfect.`;
  if (platform === "x") return `${base} #goals #progress`;
  if (platform === "linkedin")
    return `${base}\n\nBiggest lesson so far: consistency compounds. Small daily steps get you places motivation alone never will.`;
  return `[Photo idea: a snapshot of today's work session]\n\n${base}\n\n#goals #progress #accountability #growth`;
}
