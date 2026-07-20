import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { findUserByEmail } from "@/lib/data";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json().catch(() => ({})));
    const user = await findUserByEmail(body.email.toLowerCase());
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(user.id);
    const { password_hash: _omit, ...publicUser } = user;
    return NextResponse.json({ user: publicUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }
    console.error("login error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
