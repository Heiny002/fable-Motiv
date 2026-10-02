import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { claimPasswordReset, setPasswordHash, voidPasswordResets } from "@/lib/data";
import { hashToken } from "@/lib/resetToken";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

// Public: redeem a reset link. The token is single-use (atomic claim) and
// expires after an hour; an invalid, used, or expired token all look the same.
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json().catch(() => ({})));
    const userId = await claimPasswordReset(hashToken(body.token));
    if (!userId) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Ask for a new one." },
        { status: 400 }
      );
    }
    await setPasswordHash(userId, await bcrypt.hash(body.password, 10));
    await voidPasswordResets(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("reset error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
