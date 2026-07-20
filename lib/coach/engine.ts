import Anthropic from "@anthropic-ai/sdk";
import {
  addMessage,
  computeStreak,
  listActiveEvents,
  listGoalsWithPlans,
  listMemories,
  recentCheckIns,
  recentMessages,
} from "../data";
import type { PublicUser } from "../types";
import { buildSystemPrompt } from "./prompt";
import { coachTools, executeCoachTool } from "./tools";

export const COACH_MODEL = "claude-opus-4-8";
const MAX_TOOL_ROUNDS = 8;

export function anthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

export const NO_KEY_MESSAGE =
  "I'm not fully awake yet — the app's ANTHROPIC_API_KEY isn't configured, so I can't coach for real. Add the key to your environment (locally in .env, or in Vercel's Environment Variables) and I'll be right here.";

export interface CoachStreamEvent {
  type: "text" | "refresh" | "done" | "error";
  text?: string;
}

/**
 * Run one coach turn as an async generator of stream events.
 * Handles the manual tool loop: streams text deltas to the caller,
 * executes tool calls between rounds, persists the conversation.
 */
export async function* coachTurn(
  user: PublicUser,
  userMessage: string
): AsyncGenerator<CoachStreamEvent> {
  const client = anthropicClient();
  await addMessage({ user_id: user.id, role: "user", content: userMessage });

  if (!client) {
    await addMessage({ user_id: user.id, role: "assistant", content: NO_KEY_MESSAGE });
    yield { type: "text", text: NO_KEY_MESSAGE };
    yield { type: "done" };
    return;
  }

  const [goals, memories, checkIns, events, history] = await Promise.all([
    listGoalsWithPlans(user.id),
    listMemories(user.id),
    recentCheckIns(user.id),
    listActiveEvents(user.id),
    recentMessages(user.id),
  ]);

  const system = buildSystemPrompt({
    user,
    goals,
    memories,
    checkIns,
    events,
    streak: computeStreak(checkIns, user.timezone),
  });

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  // recentMessages already includes the user message we just persisted; make sure
  // the transcript ends with it even if reads are eventually consistent.
  if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  let fullText = "";
  let mutated = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = client.messages.stream({
        model: COACH_MODEL,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system,
        tools: coachTools,
        messages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "text", text: event.delta.text };
        }
      }

      const response = await stream.finalMessage();

      if (response.stop_reason === "refusal") {
        const note = "I can't help with that one — let's get back to your goals.";
        fullText += (fullText ? "\n\n" : "") + note;
        yield { type: "text", text: note };
        break;
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          try {
            const outcome = await executeCoachTool(
              user.id,
              block.name,
              block.input as Record<string, unknown>
            );
            mutated = mutated || outcome.mutated;
            results.push({ type: "tool_result", tool_use_id: block.id, content: outcome.result });
          } catch (err) {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${err instanceof Error ? err.message : "tool failed"}`,
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      break; // end_turn or anything else terminal
    }
  } catch (err) {
    const msg =
      "I hit a snag talking to my brain just now — give me a moment and try again.";
    if (!fullText) {
      yield { type: "text", text: msg };
      fullText = msg;
    }
    console.error("coachTurn error:", err);
    yield { type: "error", text: err instanceof Error ? err.message : "unknown" };
  }

  if (fullText) {
    await addMessage({ user_id: user.id, role: "assistant", content: fullText });
  }
  if (mutated) yield { type: "refresh" };
  yield { type: "done" };
}
