import type Anthropic from "@anthropic-ai/sdk";
import {
  createGoal,
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
      "Store or fully replace the agreed Master Plan for a goal: a summary plus an ordered list of milestones and tasks. Call only after the user has agreed to the plan.",
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
    default:
      return { result: JSON.stringify({ error: `Unknown tool: ${name}` }), mutated: false };
  }
}
