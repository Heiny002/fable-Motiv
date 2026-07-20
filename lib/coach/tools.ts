import type Anthropic from "@anthropic-ai/sdk";
import {
  addPlanItems,
  cancelEvent,
  createGoal,
  createScheduledEvent,
  replacePlanItems,
  saveMemory,
  setFocusGoal,
  updateGoal,
  updatePlanItem,
} from "../data";

// The Coach -> System command surface (per the Brain/Coach architecture docs),
// implemented as native tool use instead of the docs' regex command extraction.
export const coachTools: Anthropic.Tool[] = [
  {
    name: "create_goal",
    description:
      "Create a new goal for the user AFTER you and the user have agreed on it in conversation. Returns the goal_id to use with set_master_plan.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short goal title" },
        description: { type: "string", description: "1-2 sentence description of the goal and why it matters to the user" },
        target_date: { type: "string", description: "Target completion date YYYY-MM-DD, if one was agreed" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "set_master_plan",
    description:
      "Store the INITIAL Master Plan for a goal, or do a full agreed re-plan: a summary plus an ordered list of milestones and tasks. WARNING: this REPLACES every existing plan item and RESETS all completion. For adding a few items or capturing new specifics, use add_plan_items instead; for checking off or editing one item, use update_plan_item.",
    input_schema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        summary: { type: "string", description: "2-3 sentence summary of the overall strategy" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["milestone", "task"] },
              title: { type: "string" },
              detail: { type: "string" },
              due_date: { type: "string", description: "YYYY-MM-DD, optional" },
            },
            required: ["kind", "title"],
          },
        },
      },
      required: ["goal_id", "summary", "items"],
    },
  },
  {
    name: "add_plan_items",
    description:
      "Append one or more NEW milestones/tasks to a goal's existing plan WITHOUT disturbing current items or their completion. Use this to capture concrete specifics the user commits to (e.g. locking in a must-have feature list) or newly-agreed steps. This is the safe way to record details from a conversation onto the plan.",
    input_schema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["milestone", "task"] },
              title: { type: "string" },
              detail: { type: "string" },
              due_date: { type: "string", description: "YYYY-MM-DD, optional" },
            },
            required: ["kind", "title"],
          },
        },
      },
      required: ["goal_id", "items"],
    },
  },
  {
    name: "update_plan_item",
    description:
      "Update a single plan item — mark it completed/uncompleted or revise its title/detail/due date. Use the <item_id:...> values from your context.",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        completed: { type: "boolean" },
        title: { type: "string" },
        detail: { type: "string" },
        due_date: { type: "string" },
      },
      required: ["item_id"],
    },
  },
  {
    name: "update_goal",
    description: "Update a goal's status (active/completed/abandoned), title, description, or target date.",
    input_schema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        status: { type: "string", enum: ["active", "completed", "abandoned"] },
        title: { type: "string" },
        description: { type: "string" },
        target_date: { type: "string" },
        master_plan_summary: { type: "string" },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "set_focus_goal",
    description: "Mark one goal as the user's current focus goal (shown first on their dashboard).",
    input_schema: {
      type: "object",
      properties: { goal_id: { type: "string" } },
      required: ["goal_id"],
    },
  },
  {
    name: "save_memory",
    description:
      "Save a durable fact about the user for future sessions: biographical (who they are, constraints, schedule), goal (context about a specific goal), or history (past attempts, patterns).",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["biographical", "goal", "history"] },
        content: { type: "string", description: "One concise sentence" },
      },
      required: ["kind", "content"],
    },
  },
  {
    name: "start_timer",
    description:
      "Start a short, in-session timed exercise the user does right now (e.g. a 5-minute visualization, a 2-minute breathing reset, a 25-minute focus block). The user sees a live countdown with a tappable clock in chat; when it ends you'll be prompted to debrief. Use for anything on the order of seconds-to-minutes.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short name shown on the timer, e.g. 'Morning visualization'" },
        duration_minutes: { type: "number", description: "How long the exercise runs, in minutes" },
        summary: {
          type: "string",
          description: "One-line description of what the user is doing, shown when they tap the clock",
        },
        debrief_prompt: {
          type: "string",
          description: "What you intend to ask/say when the timer ends, e.g. 'Ask what they pictured and how it felt'",
        },
      },
      required: ["label", "duration_minutes", "summary"],
    },
  },
  {
    name: "schedule_event",
    description:
      "Schedule a check-in, reminder, or nudge to reach the user at a specific later moment — ANY future time from one minute to many days out (e.g. 'check in with me in a minute', 'remind me tonight', 'follow up after my Thursday workout'). Use this any time the user wants you to come back to them later and it isn't a timed in-session exercise. Provide EITHER in_minutes (relative) OR fire_at (absolute ISO 8601). Prefer in_minutes for anything relative so timezones stay correct.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short name for the check-in" },
        in_minutes: { type: "number", description: "Fire this many minutes from now (can be 1)" },
        fire_at: { type: "string", description: "Absolute time, ISO 8601 (only if not using in_minutes)" },
        summary: { type: "string", description: "One-line description shown when the user taps the clock" },
        debrief_prompt: { type: "string", description: "What you intend to say/ask when it fires" },
        goal_id: { type: "string", description: "Related goal, if any" },
      },
      required: ["label"],
    },
  },
  {
    name: "cancel_event",
    description: "Cancel a pending timer or scheduled check-in using its <event_id:...> from your context.",
    input_schema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
    },
  },
];

/** Execute a tool call from the Coach. Returns a result string for the model. */
export async function executeCoachTool(
  userId: string,
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; mutated: boolean }> {
  switch (name) {
    case "create_goal": {
      const goal = await createGoal({
        user_id: userId,
        title: String(input.title),
        description: String(input.description ?? ""),
        target_date: input.target_date ? String(input.target_date) : null,
      });
      return { result: JSON.stringify({ goal_id: goal.id }), mutated: true };
    }
    case "set_master_plan": {
      const items = (input.items as Array<{ kind: "milestone" | "task"; title: string; detail?: string; due_date?: string }>) ?? [];
      await updateGoal(userId, String(input.goal_id), {
        master_plan_summary: String(input.summary ?? ""),
      });
      const saved = await replacePlanItems(
        String(input.goal_id),
        items.map((i) => ({ kind: i.kind, title: i.title, detail: i.detail ?? "", due_date: i.due_date ?? null }))
      );
      return { result: JSON.stringify({ saved_items: saved.length }), mutated: true };
    }
    case "add_plan_items": {
      const items = (input.items as Array<{ kind: "milestone" | "task"; title: string; detail?: string; due_date?: string }>) ?? [];
      if (items.length === 0) {
        return { result: JSON.stringify({ error: "items must be a non-empty array" }), mutated: false };
      }
      const added = await addPlanItems(
        String(input.goal_id),
        items.map((i) => ({ kind: i.kind, title: i.title, detail: i.detail ?? "", due_date: i.due_date ?? null }))
      );
      return { result: JSON.stringify({ added_items: added.length }), mutated: true };
    }
    case "update_plan_item": {
      const patch: Record<string, unknown> = {};
      for (const key of ["completed", "title", "detail", "due_date"] as const) {
        if (input[key] !== undefined) patch[key] = input[key];
      }
      const item = await updatePlanItem(userId, String(input.item_id), patch);
      return { result: JSON.stringify({ ok: true, completed: item.completed }), mutated: true };
    }
    case "update_goal": {
      const patch: Record<string, unknown> = {};
      for (const key of ["status", "title", "description", "target_date", "master_plan_summary"] as const) {
        if (input[key] !== undefined) patch[key] = input[key];
      }
      await updateGoal(userId, String(input.goal_id), patch);
      return { result: JSON.stringify({ ok: true }), mutated: true };
    }
    case "set_focus_goal": {
      await setFocusGoal(userId, String(input.goal_id));
      return { result: JSON.stringify({ ok: true }), mutated: true };
    }
    case "save_memory": {
      await saveMemory({
        user_id: userId,
        kind: (input.kind as "biographical" | "goal" | "history") ?? "biographical",
        content: String(input.content),
      });
      return { result: JSON.stringify({ ok: true }), mutated: false };
    }
    case "start_timer": {
      const minutes = Number(input.duration_minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return { result: JSON.stringify({ error: "duration_minutes must be a positive number" }), mutated: false };
      }
      const fireAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const event = await createScheduledEvent({
        user_id: userId,
        kind: "timer",
        label: String(input.label),
        summary: String(input.summary ?? ""),
        debrief_prompt: String(input.debrief_prompt ?? ""),
        fire_at: fireAt,
      });
      return {
        result: JSON.stringify({ event_id: event.id, fires_at: fireAt, note: "Timer started; a countdown is now showing in the user's chat." }),
        mutated: true,
      };
    }
    case "schedule_event": {
      let fireAt: string;
      if (input.in_minutes !== undefined && input.in_minutes !== null) {
        const minutes = Number(input.in_minutes);
        if (!Number.isFinite(minutes) || minutes <= 0) {
          return { result: JSON.stringify({ error: "in_minutes must be a positive number" }), mutated: false };
        }
        fireAt = new Date(Date.now() + minutes * 60_000).toISOString();
      } else if (input.fire_at) {
        const parsed = new Date(String(input.fire_at));
        if (Number.isNaN(parsed.getTime())) {
          return { result: JSON.stringify({ error: "fire_at is not a valid ISO 8601 timestamp" }), mutated: false };
        }
        fireAt = parsed.toISOString();
      } else {
        return { result: JSON.stringify({ error: "Provide either in_minutes or fire_at" }), mutated: false };
      }
      const event = await createScheduledEvent({
        user_id: userId,
        goal_id: input.goal_id ? String(input.goal_id) : null,
        kind: "reminder",
        label: String(input.label),
        summary: String(input.summary ?? ""),
        debrief_prompt: String(input.debrief_prompt ?? ""),
        fire_at: fireAt,
      });
      return { result: JSON.stringify({ event_id: event.id, fires_at: fireAt }), mutated: true };
    }
    case "cancel_event": {
      await cancelEvent(userId, String(input.event_id));
      return { result: JSON.stringify({ ok: true }), mutated: true };
    }
    default:
      return { result: JSON.stringify({ error: `Unknown tool: ${name}` }), mutated: false };
  }
}
