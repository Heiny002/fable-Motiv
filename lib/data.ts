import { db } from "./supabase";
import type {
  ChatMessage,
  CheckIn,
  Goal,
  GoalWithPlan,
  Memory,
  PlanItem,
  PublicUser,
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

export async function saveMemory(input: {
  user_id: string;
  kind: Memory["kind"];
  content: string;
}): Promise<Memory> {
  return unwrap(await db().from("memories").insert(input).select("*").single<Memory>());
}

export async function listMemories(userId: string, limit = 50): Promise<Memory[]> {
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
