import { addMessage, getProactiveState, lastUserActivityAt, setProactiveState } from "./data";
import {
  idleDays,
  localDay,
  stageForIdleDays,
  transitionNotice,
  type InactivityStage,
} from "./inactivity";
import { sendPushToUser } from "./push";
import type { PublicUser } from "./types";

/**
 * Gate for EVERY message the coach starts on its own (ritual nudges, day-closed,
 * timer/reminder firings, the daily reminder push). Returns true if it may send.
 *
 * - Active user: always true.
 * - Quiet 14+ days (3+ if they never engaged): true at most once per local day.
 * - Quiet 30+ days (10+ if they never engaged): false until the user acts again.
 *
 * Crossing a threshold sends ONE static heads-up (no model call) and returns
 * false for that attempt, so the notice itself is that day's single message.
 * Anything the user does resets everything automatically, because "idle" is
 * measured from their last real action.
 */
export async function allowProactive(user: PublicUser): Promise<boolean> {
  const now = Date.now();
  const { at: lastActive, engaged } = await lastUserActivityAt(user.id, user.created_at);
  const days = idleDays(new Date(lastActive).getTime(), now);
  const stage: InactivityStage = stageForIdleDays(days, engaged);
  const state = await getProactiveState(user.id);

  if (stage === 0) {
    if (state.inactivity_stage !== 0) await setProactiveState(user.id, { inactivity_stage: 0 });
    return true;
  }

  // Newly crossed a threshold (or re-crossed after coming back): announce once.
  if (state.inactivity_stage !== stage) {
    await setProactiveState(user.id, {
      inactivity_stage: stage,
      last_proactive_at: new Date(now).toISOString(),
    });
    const notice = transitionNotice(stage, user.name, days, engaged);
    await addMessage({ user_id: user.id, role: "assistant", content: notice.body });
    await sendPushToUser(user.id, { title: notice.title, body: notice.body, url: "/chat" });
    return false;
  }

  if (stage === 2) return false;

  // Stage 1: one unprompted message per local day.
  if (
    state.last_proactive_at &&
    localDay(state.last_proactive_at, user.timezone) === localDay(now, user.timezone)
  ) {
    return false;
  }
  await setProactiveState(user.id, { last_proactive_at: new Date(now).toISOString() });
  return true;
}
