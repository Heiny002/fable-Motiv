import { addMessage, getPowerTasks } from "../data";
import { userLocalDate } from "../date";
import { sendPushToUser } from "../push";
import type { PublicUser } from "../types";
import { anthropicClient, COACH_MODEL } from "./engine";
import { PERSONALITIES } from "./prompt";

export type RitualKind = "evening" | "morning";

function fallback(kind: RitualKind, name: string): string {
  return kind === "evening"
    ? `Evening, ${name}. Let's review how today went and set tomorrow's top 5. Ready to plan?`
    : `Morning, ${name}. Here's your Power List for today — what's the one that matters most? Let's win the day.`;
}

/**
 * Fire a daily ritual nudge: compose a short coach opener in the user's voice,
 * store it as a chat message, and push it. When the user opens chat and replies,
 * the full engine (with the ritual context in the system prompt) takes over.
 */
export async function fireRitual(user: PublicUser, kind: RitualKind): Promise<void> {
  const todayStr = userLocalDate(user.timezone, 0);
  const tasks = await getPowerTasks(user.id, todayStr);
  const done = tasks.filter((t) => t.completed).length;

  const client = anthropicClient();
  let message = fallback(kind, user.name);

  if (client) {
    const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;
    const context =
      kind === "evening"
        ? `It is ${user.name}'s bedtime — the last thing before sleep. Today's Power List: ${
            tasks.length ? `${done}/${tasks.length} done` : "was never set"
          }. Open the evening ritual: warmly prompt them to (1) review today with you — celebrate a 100% win or get honest if not — and (2) plan tomorrow's top 5. 1-3 sentences, your voice, end by inviting them in.`
        : `It is ${user.name}'s wake time — the first thing on waking. Today's Power List: ${
            tasks.length ? `${tasks.length} task(s) queued` : "not set yet"
          }. Open the morning with a quick intention-setting nudge pointing them at today's most important task. 1-3 sentences, your voice.`;

    try {
      const response = await client.messages.create({
        model: COACH_MODEL,
        max_tokens: 400,
        thinking: { type: "adaptive" },
        // One short opener — no need to spend deep reasoning on it.
        output_config: { effort: "low" },
        system: `You are Motiv, ${user.name}'s AI goal coach (${personality.label}). ${personality.voice} ${
          user.allow_profanity ? "Mild profanity is allowed if it fits your style." : "Never use profanity."
        } Write a short opener (1-3 sentences). No preamble, no lists, no markdown headers.`,
        messages: [{ role: "user", content: context }],
      });
      const text = response.content.find((b) => b.type === "text");
      if (response.stop_reason !== "refusal" && text && text.type === "text" && text.text.trim()) {
        message = text.text.trim();
      }
    } catch {
      /* keep fallback */
    }
  }

  await addMessage({ user_id: user.id, role: "assistant", content: message });
  await sendPushToUser(user.id, {
    title: kind === "evening" ? "🌙 Plan tomorrow" : "☀️ Today's plan",
    body: message.length > 120 ? `${message.slice(0, 117)}…` : message,
    url: "/chat",
  });
}
