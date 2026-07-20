export type CoachStyle = "gentle" | "supportive" | "challenging" | "drill_sergeant";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  coach_style: CoachStyle;
  allow_profanity: boolean;
  checkin_hour: number;
  timezone: string;
  created_at: string;
}

export type PublicUser = Omit<User, "password_hash">;

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "abandoned";
  is_focus: boolean;
  target_date: string | null;
  master_plan_summary: string;
  created_at: string;
}

export interface PlanItem {
  id: string;
  goal_id: string;
  position: number;
  kind: "milestone" | "task";
  title: string;
  detail: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  // Structured content (text + tool_use / tool_result blocks) for faithful
  // model replay; null for plain text messages.
  blocks: unknown[] | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  goal_id: string | null;
  mood: number;
  note: string;
  coach_reply: string;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  kind: "biographical" | "goal" | "history";
  content: string;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface GoalWithPlan extends Goal {
  plan_items: PlanItem[];
}

export type EventKind = "timer" | "reminder" | "nudge";

export interface ScheduledEvent {
  id: string;
  user_id: string;
  goal_id: string | null;
  kind: EventKind;
  label: string;
  summary: string;
  debrief_prompt: string;
  fire_at: string;
  status: "pending" | "fired" | "cancelled";
  created_at: string;
  fired_at: string | null;
}
