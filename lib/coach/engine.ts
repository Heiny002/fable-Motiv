import Anthropic from "@anthropic-ai/sdk";
import {
  addMessage,
  computePowerStreak,
  computeStreak,
  getPowerTasks,
  getPowerTasksBetween,
  listActiveEvents,
  listGoalsWithPlans,
  listMemories,
  recentCheckIns,
  recentMessages,
} from "../data";
import { userLocalDate } from "../date";
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
  type: "text" | "refresh" | "done" | "error" | "memory";
  text?: string;
  memory?: { kind: string; content: string };
}

function isToolResultContent(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    content.every((b) => (b as { type?: string }).type === "tool_result")
  );
}

/**
 * The API requires the transcript to begin with a user message, and a
 * tool_result block must always follow its tool_use. When the recent-messages
 * window slices mid-pair, drop leading messages until we reach a real user turn
 * (not an orphaned tool_result) so replay is always valid.
 */
function sanitizeTranscript(msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  let start = 0;
  while (
    start < msgs.length &&
    (msgs[start].role !== "user" || isToolResultContent(msgs[start].content))
  ) {
    start += 1;
  }
  return msgs.slice(start);
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

  const todayStr = userLocalDate(user.timezone, 0);
  const tomorrowStr = userLocalDate(user.timezone, 1);
  const [goals, memories, checkIns, events, powerToday, powerTomorrow, powerRecent, history] =
    await Promise.all([
      listGoalsWithPlans(user.id),
      listMemories(user.id),
      recentCheckIns(user.id),
      listActiveEvents(user.id),
      getPowerTasks(user.id, todayStr),
      getPowerTasks(user.id, tomorrowStr),
      getPowerTasksBetween(user.id, userLocalDate(user.timezone, -14), todayStr),
      recentMessages(user.id),
    ]);

  const system = buildSystemPrompt({
    user,
    goals,
    memories,
    checkIns,
    events,
    powerToday,
    powerTomorrow,
    powerStreak: computePowerStreak(powerRecent, todayStr),
    todayStr,
    streak: computeStreak(checkIns, user.timezone),
  });

  // Rebuild the model transcript from stored structured content: messages that
  // carried tool_use/tool_result replay those blocks (so the coach's own memory
  // truthfully shows the tools it called); plain messages replay as text.
  let messages: Anthropic.MessageParam[] = history.map((m) =>
    m.blocks && m.blocks.length > 0
      ? ({ role: m.role, content: m.blocks } as Anthropic.MessageParam)
      : ({ role: m.role, content: m.content } as Anthropic.MessageParam)
  );
  messages = sanitizeTranscript(messages);
  // recentMessages already includes the user message we just persisted; ensure
  // the transcript ends with it even if reads are eventually consistent.
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || typeof lastMsg.content !== "string") {
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

      let roundText = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          roundText += event.delta.text;
          fullText += event.delta.text;
          yield { type: "text", text: event.delta.text };
        }
      }

      const response = await stream.finalMessage();

      const toolNames = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => (b as Anthropic.ToolUseBlock).name);
      console.log(
        `[coach] user=${user.id} round=${round} stop=${response.stop_reason} tools=[${toolNames.join(",")}]`
      );

      if (response.stop_reason === "refusal") {
        const note = "I can't help with that one — let's get back to your goals.";
        yield { type: "text", text: note };
        await addMessage({ user_id: user.id, role: "assistant", content: note });
        break;
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        // Persist this assistant turn WITH its tool_use blocks so future turns
        // see that the tool was actually called (not just the confirmation text).
        const assistantBlocks = response.content
          .filter((b) => b.type === "text" || b.type === "tool_use")
          .map((b) =>
            b.type === "text"
              ? { type: "text", text: b.text }
              : { type: "tool_use", id: b.id, name: b.name, input: b.input }
          );
        await addMessage({
          user_id: user.id,
          role: "assistant",
          content: roundText,
          blocks: assistantBlocks,
        });

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          try {
            console.log(`[coach] tool=${block.name} input=${JSON.stringify(block.input)}`);
            const outcome = await executeCoachTool(
              user,
              block.name,
              block.input as Record<string, unknown>
            );
            mutated = mutated || outcome.mutated;
            console.log(`[coach] tool=${block.name} result=${outcome.result}`);
            // Surface a live indicator when the coach records a NEW memory
            // (deduped saves don't fire — nothing new was stored).
            if (outcome.memory?.created) {
              yield {
                type: "memory",
                memory: { kind: outcome.memory.kind, content: outcome.memory.content },
              };
            }
            results.push({ type: "tool_result", tool_use_id: block.id, content: outcome.result });
          } catch (err) {
            console.error(`[coach] tool=${block.name} ERROR:`, err);
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${err instanceof Error ? err.message : "tool failed"}`,
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: results });
        await addMessage({
          user_id: user.id,
          role: "user",
          content: "",
          blocks: results as unknown[],
        });
        continue;
      }

      // Terminal round — persist the coach's final text as a plain message.
      if (roundText) {
        await addMessage({ user_id: user.id, role: "assistant", content: roundText });
      }
      break;
    }
  } catch (err) {
    const msg =
      "I hit a snag talking to my brain just now — give me a moment and try again.";
    if (!fullText) {
      yield { type: "text", text: msg };
      await addMessage({ user_id: user.id, role: "assistant", content: msg });
    }
    console.error("coachTurn error:", err);
    yield { type: "error", text: err instanceof Error ? err.message : "unknown" };
  }

  if (mutated) yield { type: "refresh" };
  yield { type: "done" };
}
