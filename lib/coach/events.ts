import { addMessage } from "../data";
import { sendPushToUser } from "../push";
import type { PublicUser, ScheduledEvent } from "../types";
import { anthropicClient, COACH_MODEL } from "./engine";
import { PERSONALITIES } from "./prompt";

function fallbackMessage(event: ScheduledEvent): string {
  if (event.kind === "timer") {
    return `Time's up on "${event.label}." How did that go?`;
  }
  return `Checking in on "${event.label}."${event.summary ? ` ${event.summary}` : ""}`;
}

/** Compose the coach's opening message for a fired timer/reminder, in the user's personality. */
export async function generateEventMessage(
  user: PublicUser,
  event: ScheduledEvent
): Promise<string> {
  const client = anthropicClient();
  if (!client) return fallbackMessage(event);

  const personality = PERSONALITIES[user.coach_style] ?? PERSONALITIES.supportive;
  const opener =
    event.kind === "timer"
      ? `The timer you set for "${event.label}" just finished.`
      : `The scheduled moment for "${event.label}" has arrived.`;

  try {
    const response = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 512,
      thinking: { type: "adaptive" },
      system: `You are Motiv, ${user.name}'s AI goal coach (${personality.label}). ${personality.voice} ${
        user.allow_profanity ? "Mild profanity is allowed if it fits your style." : "Never use profanity."
      } Write a short message (1-3 sentences) to open this check-in in your voice. No preamble, no lists, no markdown headers.`,
      messages: [
        {
          role: "user",
          content: `${opener}\nYour intent for this moment: ${
            event.debrief_prompt || "Check in on how it went and point them at the next step."
          }\nContext: ${event.summary || "(none)"}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return fallbackMessage(event);
    const text = response.content.find((b) => b.type === "text");
    return text && text.type === "text" && text.text.trim()
      ? text.text.trim()
      : fallbackMessage(event);
  } catch {
    return fallbackMessage(event);
  }
}

/**
 * Fire an already-claimed event: generate the coach's message, store it in the
 * chat, and (server path only) push a notification. Returns the message text.
 */
export async function fireEvent(
  user: PublicUser,
  event: ScheduledEvent,
  opts: { sendPush: boolean }
): Promise<string> {
  const message = await generateEventMessage(user, event);
  await addMessage({ user_id: user.id, role: "assistant", content: message });
  if (opts.sendPush) {
    await sendPushToUser(user.id, {
      title: event.kind === "timer" ? `⏱ ${event.label}` : `🎯 ${event.label}`,
      body: message.length > 120 ? `${message.slice(0, 117)}…` : message,
      url: "/chat",
    });
  }
  return message;
}
