import { db } from "./supabase";
import type {
  ChatMessage,
  CheckIn,
  EventKind,
  Goal,
  GoalWithPlan,
  Memory,
  PlanItem,
  PowerTask,
  PublicUser,
  ScheduledEvent,
  User,
} from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("Not found");
  return res.data;
}

// ---------- users ----------

export async function createUser(input: {
  email: string;
  password_hash: string;
  name: string;
}): Promise<PublicUser> {
  return unwrap(
    await db()
      .from("users")
      .insert(input)
      .select("id,email,name,coach_style,allow_profanity,checkin_hour,timezone,created_at")
      .single<PublicUser>()
  );
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await db().from("users").select("*").eq("email", email).maybeSingle<User>();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const res = await db()
    .from("users")
    .select("id,email,name,coach_style,allow_profanity,checkin_hour,timezone,created_at")
    .eq("id", id)
    .maybeSingle<PublicUser>();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "name" | "coach_style" | "allow_profanity" | "checkin_hour" | "timezone">>
): Promise<PublicUser> {
  return unwrap(
    await db()
      .from("users")
      .update(patch)
      .eq("id", id)
      .select("id,email,name,coach_style,allow_profanity,checkin_hour,timezone,created_at")
      .single<PublicUser>()
  );
}

// ---------- goals & plans ----------

export async function createGoal(input: {
  user_id: string;
  title: string;
  description?: string;
  target_date?: string | null;
}): Promise<Goal> {
  const existing = await listGoals(input.user_id);
  return unwrap(
    await db()
      .from("goals")
      .insert({ ...input, is_focus: existing.filter((g) => g.status === "active").length === 0 })
      .select("*")
      .single<Goal>()
  );
}

export async function listGoals(userId: string): Promise<Goal[]> {
  return unwrap(
    await db()
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<Goal[]>()
  );
}

export async function listGoalsWithPlans(userId: string): Promise<GoalWithPlan[]> {
  return unwrap(
    await db()
      .from("goals")
      .select("*, plan_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("position", { referencedTable: "plan_items", ascending: true })
      .returns<GoalWithPlan[]>()
  );
}

export async function getGoal(userId: string, goalId: string): Promise<GoalWithPlan | null> {
  const res = await db()
    .from("goals")
    .select("*, plan_items(*)")
    .eq("user_id", userId)
    .eq("id", goalId)
    .order("position", { referencedTable: "plan_items", ascending: true })
    .maybeSingle<GoalWithPlan>();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  patch: Partial<Pick<Goal, "title" | "description" | "status" | "target_date" | "master_plan_summary">>
): Promise<Goal> {
  return unwrap(
    await db().from("goals").update(patch).eq("id", goalId).eq("user_id", userId).select("*").single<Goal>()
  );
}

export async function setFocusGoal(userId: string, goalId: string): Promise<void> {
  const client = db();
  const clear = await client.from("goals").update({ is_focus: false }).eq("user_id", userId);
  if (clear.error) throw new Error(clear.error.message);
  const set = await client.from("goals").update({ is_focus: true }).eq("id", goalId).eq("user_id", userId);
  if (set.error) throw new Error(set.error.message);
}

export async function replacePlanItems(
  goalId: string,
  items: Array<{ kind: "milestone" | "task"; title: string; detail?: string; due_date?: string | null }>
): Promise<PlanItem[]> {
  const client = db();
  const del = await client.from("plan_items").delete().eq("goal_id", goalId);
  if (del.error) throw new Error(del.error.message);
  return unwrap(
    await client
      .from("plan_items")
      .insert(items.map((item, i) => ({ ...item, goal_id: goalId, position: i })))
      .select("*")
      .returns<PlanItem[]>()
  );
}

/** Append new items to a goal's plan without touching existing items or their completion. */
export async function addPlanItems(
  goalId: string,
  items: Array<{ kind: "milestone" | "task"; title: string; detail?: string; due_date?: string | null }>
): Promise<PlanItem[]> {
  const client = db();
  const existing = unwrap(
    await client
      .from("plan_items")
      .select("position")
      .eq("goal_id", goalId)
      .order("position", { ascending: false })
      .limit(1)
      .returns<Array<{ position: number }>>()
  );
  const start = existing.length ? existing[0].position + 1 : 0;
  return unwrap(
    await client
      .from("plan_items")
      .insert(
        items.map((item, i) => ({
          kind: item.kind,
          title: item.title,
          detail: item.detail ?? "",
          due_date: item.due_date ?? null,
          goal_id: goalId,
          position: start + i,
        }))
      )
      .select("*")
      .returns<PlanItem[]>()
  );
}

export async function updatePlanItem(
  userId: string,
  itemId: string,
  patch: Partial<Pick<PlanItem, "title" | "detail" | "completed" | "due_date">>
): Promise<PlanItem> {
  // Ownership check via the parent goal.
  const item = await db()
    .from("plan_items")
    .select("id, goals!inner(user_id)")
    .eq("id", itemId)
    .eq("goals.user_id", userId)
    .maybeSingle();
  if (item.error) throw new Error(item.error.message);
  if (!item.data) throw new Error("Not found");

  const full: Record<string, unknown> = { ...patch };
  if (patch.completed !== undefined) {
    full.completed_at = patch.completed ? new Date().toISOString() : null;
  }
  return unwrap(
    await db().from("plan_items").update(full).eq("id", itemId).select("*").single<PlanItem>()
  );
}

// ---------- chat messages ----------

export async function addMessage(input: {
  user_id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: unknown[] | null;
}): Promise<ChatMessage> {
  return unwrap(await db().from("messages").insert(input).select("*").single<ChatMessage>());
}

export async function recentMessages(userId: string, limit = 40): Promise<ChatMessage[]> {
  const rows = unwrap(
    await db()
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<ChatMessage[]>()
  );
  return rows.reverse();
}

// ---------- check-ins ----------

export async function addCheckIn(input: {
  user_id: string;
  goal_id?: string | null;
  mood: number;
  note: string;
  coach_reply: string;
}): Promise<CheckIn> {
  return unwrap(await db().from("checkins").insert(input).select("*").single<CheckIn>());
}

export async function recentCheckIns(userId: string, limit = 30): Promise<CheckIn[]> {
  return unwrap(
    await db()
      .from("checkins")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<CheckIn[]>()
  );
}

/** Consecutive days (ending today or yesterday) with at least one check-in. */
export function computeStreak(checkIns: CheckIn[], timezone: string): number {
  const days = new Set(
    checkIns.map((c) =>
      new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: timezone })
    )
  );
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to survive if today's check-in hasn't happened yet.
  const today = cursor.toLocaleDateString("en-CA", { timeZone: timezone });
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toLocaleDateString("en-CA", { timeZone: timezone });
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- memories ----------

/** Normalize memory text for duplicate comparison: lowercase, strip
 *  punctuation, collapse whitespace. */
function normalizeMemory(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-set Jaccard similarity of two normalized strings (0..1). */
function memorySimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  const sa = Array.from(new Set(ta));
  const sb = new Set(tb);
  if (sa.length === 0 || sb.size === 0) return 0;
  const inter = sa.filter((t) => sb.has(t)).length;
  return inter / (sa.length + sb.size - inter);
}

/**
 * Save a durable memory, skipping near-duplicates. If an existing memory for
 * the same user is an exact normalized match or ≥ 0.82 token-similar, we keep
 * the existing row instead of inserting a second copy (returns it unchanged).
 */
export async function saveMemory(input: {
  user_id: string;
  kind: Memory["kind"];
  content: string;
}): Promise<{ memory: Memory; created: boolean }> {
  const incoming = normalizeMemory(input.content);
  if (incoming) {
    const existing = unwrap(
      await db()
        .from("memories")
        .select("*")
        .eq("user_id", input.user_id)
        .order("created_at", { ascending: false })
        .limit(400)
        .returns<Memory[]>()
    );
    const dup = existing.find((m) => memorySimilarity(normalizeMemory(m.content), incoming) >= 0.82);
    if (dup) return { memory: dup, created: false };
  }
  const memory = unwrap(await db().from("memories").insert(input).select("*").single<Memory>());
  return { memory, created: true };
}

export async function listMemories(userId: string, limit = 200): Promise<Memory[]> {
  return unwrap(
    await db()
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Memory[]>()
  );
}

export async function deleteMemory(userId: string, id: string): Promise<void> {
  const res = await db().from("memories").delete().eq("id", id).eq("user_id", userId);
  if (res.error) throw new Error(res.error.message);
}

// ---------- push subscriptions ----------

export async function savePushSubscription(input: {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const res = await db()
    .from("push_subscriptions")
    .upsert(input, { onConflict: "endpoint" });
  if (res.error) throw new Error(res.error.message);
}

export async function listPushSubscriptions(userId: string) {
  return unwrap(
    await db().from("push_subscriptions").select("*").eq("user_id", userId).returns<
      Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
    >()
  );
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// ---------- scheduled events (timers / reminders / nudges) ----------

export async function createScheduledEvent(input: {
  user_id: string;
  goal_id?: string | null;
  kind: EventKind;
  label: string;
  summary?: string;
  debrief_prompt?: string;
  fire_at: string;
}): Promise<ScheduledEvent> {
  return unwrap(
    await db().from("scheduled_events").insert(input).select("*").single<ScheduledEvent>()
  );
}

/** Pending events for a user, soonest first — powers the chat timer badge. */
export async function listActiveEvents(userId: string): Promise<ScheduledEvent[]> {
  return unwrap(
    await db()
      .from("scheduled_events")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("fire_at", { ascending: true })
      .returns<ScheduledEvent[]>()
  );
}

export async function getEvent(userId: string, id: string): Promise<ScheduledEvent | null> {
  const res = await db()
    .from("scheduled_events")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<ScheduledEvent>();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** All pending events whose time has arrived (across all users). */
export async function listDueEvents(nowIso: string): Promise<ScheduledEvent[]> {
  return unwrap(
    await db()
      .from("scheduled_events")
      .select("*")
      .eq("status", "pending")
      .lte("fire_at", nowIso)
      .order("fire_at", { ascending: true })
      .returns<ScheduledEvent[]>()
  );
}

/**
 * Atomically claim a pending event by flipping it to 'fired'. Returns the row
 * if this caller won the transition, or null if it was already claimed —
 * so the cron sweeper and the client's fire-on-zero can't double-fire.
 */
export async function claimEvent(id: string): Promise<ScheduledEvent | null> {
  const res = await db()
    .from("scheduled_events")
    .update({ status: "fired", fired_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<ScheduledEvent>();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function cancelEvent(userId: string, id: string): Promise<void> {
  const res = await db()
    .from("scheduled_events")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (res.error) throw new Error(res.error.message);
}

// ---------- power list (daily action plan) ----------

export async function getPowerTasks(userId: string, planDate: string): Promise<PowerTask[]> {
  return unwrap(
    await db()
      .from("power_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_date", planDate)
      .order("position", { ascending: true })
      .returns<PowerTask[]>()
  );
}

export async function getPowerTasksBetween(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<PowerTask[]> {
  return unwrap(
    await db()
      .from("power_tasks")
      .select("*")
      .eq("user_id", userId)
      .gte("plan_date", fromDate)
      .lte("plan_date", toDate)
      .order("plan_date", { ascending: true })
      .order("position", { ascending: true })
      .returns<PowerTask[]>()
  );
}

/** Replace the whole Power List for a given day. */
export async function setPowerList(
  userId: string,
  planDate: string,
  items: Array<{ title: string; goal_id?: string | null }>
): Promise<PowerTask[]> {
  const client = db();
  const del = await client
    .from("power_tasks")
    .delete()
    .eq("user_id", userId)
    .eq("plan_date", planDate);
  if (del.error) throw new Error(del.error.message);
  if (items.length === 0) return [];
  return unwrap(
    await client
      .from("power_tasks")
      .insert(
        items.map((item, i) => ({
          user_id: userId,
          plan_date: planDate,
          position: i,
          title: item.title,
          goal_id: item.goal_id ?? null,
        }))
      )
      .select("*")
      .returns<PowerTask[]>()
  );
}

export async function addPowerTask(input: {
  user_id: string;
  plan_date: string;
  title: string;
  goal_id?: string | null;
}): Promise<PowerTask> {
  const existing = await getPowerTasks(input.user_id, input.plan_date);
  return unwrap(
    await db()
      .from("power_tasks")
      .insert({ ...input, position: existing.length })
      .select("*")
      .single<PowerTask>()
  );
}

export async function updatePowerTask(
  userId: string,
  id: string,
  patch: { completed?: boolean; title?: string }
): Promise<PowerTask> {
  const full: Record<string, unknown> = { ...patch };
  if (patch.completed !== undefined) {
    full.completed_at = patch.completed ? new Date().toISOString() : null;
  }
  return unwrap(
    await db()
      .from("power_tasks")
      .update(full)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single<PowerTask>()
  );
}

export async function deletePowerTask(userId: string, id: string): Promise<void> {
  const res = await db().from("power_tasks").delete().eq("id", id).eq("user_id", userId);
  if (res.error) throw new Error(res.error.message);
}

/** Consecutive "won" days (every task complete) ending today or yesterday. Today
 *  still in progress doesn't break the streak. */
export function computePowerStreak(tasks: PowerTask[], todayStr: string): number {
  const byDate = new Map<string, PowerTask[]>();
  for (const t of tasks) {
    const list = byDate.get(t.plan_date) ?? [];
    list.push(t);
    byDate.set(t.plan_date, list);
  }
  const won = (list: PowerTask[] | undefined) =>
    !!list && list.length > 0 && list.every((t) => t.completed);

  let streak = 0;
  const cursor = new Date(`${todayStr}T00:00:00`);
  const todayList = byDate.get(todayStr);
  // If today isn't won yet, start counting from yesterday (today's not over).
  if (!won(todayList)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toLocaleDateString("en-CA");
    if (!won(byDate.get(key))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function usersForCheckinHour(utcNow: Date): Promise<PublicUser[]> {
  // Fetch all users, filter by their local hour matching their checkin_hour.
  const users = unwrap(
    await db()
      .from("users")
      .select("id,email,name,coach_style,allow_profanity,checkin_hour,timezone,created_at")
      .returns<PublicUser[]>()
  );
  return users.filter((u) => {
    try {
      const hour = parseInt(
        utcNow.toLocaleString("en-US", { timeZone: u.timezone, hour: "2-digit", hour12: false }),
        10
      );
      return hour === u.checkin_hour;
    } catch {
      return false;
    }
  });
}
