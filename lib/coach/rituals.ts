import { addMessage, getPowerTasks } from "../data";
import { userLocalDate } from "../date";
import { sendPushToUser } from "../push";
import type { PublicUser } from "../types";
import { anthropicClient, COACH_MODEL } from "./engine";
import { PERSONALITIES } from "./prompt";

export type RitualKind = "evening" | "morning";

export interface RitualState {
  /** A finished day still awaiting its review — the miss we're recovering from. */
  pendingDate?: string | null;
  /** How many resolved days in a row were lost, for escalation. */
  consecutiveLosses: number;
  /** Unfinished tasks pulled forward into today. */
  carriedCount: number;
}

const EMPTY_STATE: RitualState = { pendingDate: null, consecutiveLosses: 0, carriedCount: 0 };

function fallback(kind: RitualKind, name: string, state: RitualState): string {
  if (kind === "evening") {
    return `Evening, ${name}. Let's review how today went and set tomorrow's top 5. Ready to plan?`;
  }
  if (state.pendingDate) {
    return `Morning, ${name}. We didn't close out yesterday — give me two minutes to review it and set today up.`;
  }
  return `Morning, ${name}. Here's your Power List for today — what's the one that matters most? Let's win the day.`;
}

/** Escalating framing so a week of silence doesn't read like day one. */
function escalation(losses: number): string {
  if (losses >= 3)
    return ` They have now lost ${losses} days in a row — this is the signal the plan is too heavy, not that they are failing. Say so plainly and offer to cut the list down to something they can actually win. Do not pile on.`;
  if (losses === 2)
    return " That's two lost days in a row — name it directly, without shame, and get them back to a list they can win.";
  if (losses === 1) return " Yesterday was a loss — acknowledge it briefly and move them forward.";
  return "";
}

/**
 * Fire a daily ritual nudge: compose a short coach opener in the user's voice
 * that reflects the day's real state (missed review, carry-over, losing streak),
 * store it as a chat message, and push it. When the user opens chat and replies,
 * the full engine takes over with the same context in its system prompt.
 */
export async function fireRitual(
  user: PublicUser,
  kind: RitualKind,
  state: RitualState = EMPTY_STATE
): Promise<void> {
  const todayStr = userLocalDate(user.timezone, 0);
  const tasks = await getPowerTasks(user.id, todayStr);
  const done = tasks.filter((t) => t.completed).length;

  const client = anthropicClient();
  let message = fallback(kind, user.name, state);

  if (client) {
    const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;

    let context: string;
    if (kind === "evening") {
      context = `It is ${user.name}'s bedtime — the last thing before sleep. Today's Power List: ${
        tasks.length ? `${done}/${tasks.length} done` : "was never set"
      }.${escalation(state.consecutiveLosses)} Open the evening ritual: warmly prompt them to (1) review today with you — celebrate a 100% win or get honest if not — and (2) plan tomorrow's top 5. 1-3 sentences, your voice, end by inviting them in.`;
    } else if (state.pendingDate) {
      // Recovery morning: they skipped last night's review entirely.
      context = `It is ${user.name}'s wake time. They MISSED last night's review — ${state.pendingDate} is still unreviewed and closes at noon today, after which it counts as a loss.${
        state.carriedCount > 0
          ? ` ${state.carriedCount} unfinished task(s) were carried into today.`
          : ""
      }${escalation(state.consecutiveLosses)} Open with recovery, not a normal greeting: acknowledge the miss in one line without guilt-tripping, and ask them to close out yesterday with you now — it takes a minute. Make it feel easy to come back. 1-3 sentences, your voice.`;
    } else {
      context = `It is ${user.name}'s wake time — the first thing on waking. Today's Power List: ${
        tasks.length ? `${tasks.length} task(s) queued` : "not set yet"
      }.${escalation(state.consecutiveLosses)} Open the morning with a quick intention-setting nudge pointing them at today's most important task. 1-3 sentences, your voice.`;
    }

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
    title: kind === "evening" ? "🌙 Plan tomorrow" : state.pendingDate ? "☀️ Let's close out yesterday" : "☀️ Today's plan",
    body: message.length > 120 ? `${message.slice(0, 117)}…` : message,
    url: "/chat",
  });
}

/**
 * A day passed its noon review deadline unreviewed and was auto-scored a loss.
 * Tell the user plainly instead of letting the streak vanish silently.
 */
export async function fireDayClosed(
  user: PublicUser,
  planDate: string,
  outcome: { done: number; total: number; consecutiveLosses: number }
): Promise<void> {
  const client = anthropicClient();
  let message = `${planDate} closed without a review, so it doesn't count as a win — ${outcome.done}/${outcome.total} done. Fresh start today: let's build a list you can finish.`;

  if (client) {
    const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;
    try {
      const response = await client.messages.create({
        model: COACH_MODEL,
        max_tokens: 400,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: `You are Motiv, ${user.name}'s AI goal coach (${personality.label}). ${personality.voice} ${
          user.allow_profanity ? "Mild profanity is allowed if it fits your style." : "Never use profanity."
        } Write a short message (1-3 sentences). No preamble, no lists, no markdown headers.`,
        messages: [
          {
            role: "user",
            content: `${user.name} never reviewed ${planDate} — the noon deadline just passed, so it is now scored as NOT won and their win streak resets. They finished ${outcome.done} of ${outcome.total} task(s) that day.${escalation(outcome.consecutiveLosses)} Tell them the day closed and the streak reset, matter-of-factly and without shaming, then point them at today — offer to rebuild a list they can actually win. 1-3 sentences, your voice.`,
          },
        ],
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
    title: "Day closed",
    body: message.length > 120 ? `${message.slice(0, 117)}…` : message,
    url: "/chat",
  });
}
