import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { addMessage, createUser, findUserByEmail } from "@/lib/data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const WELCOME =
  "Hey, I'm Motiv — your coach. I'm here to help you pick a goal that actually matters to you, build a real plan for it, and then hold you to it. So let's start simple: what's the one thing you want to achieve?";

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json().catch(() => ({})));
    const existing = await findUserByEmail(body.email.toLowerCase());
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    const user = await createUser({
      email: body.email.toLowerCase(),
      name: body.name,
      password_hash: await bcrypt.hash(body.password, 10),
    });
    await addMessage({ user_id: user.id, role: "assistant", content: WELCOME });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("register error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
