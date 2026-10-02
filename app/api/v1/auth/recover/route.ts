import { NextResponse } from "next/server";
import { z } from "zod";
import {
  countRecentRecoveryFailures,
  createPasswordReset,
  findUserByEmail,
  recordRecoveryFailure,
  voidPasswordResets,
} from "@/lib/data";
import {
  ATTEMPT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  RECOVERY_LINK_TTL_MS,
  recoveryAllowed,
  recoveryConfigured,
} from "@/lib/recovery";
import { newResetToken } from "@/lib/resetToken";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(1).max(200),
});

const FAILED = "That didn't work. Check the email and recovery code.";

// Public break-glass for a locked-out ADMIN: the right email + the RECOVERY_CODE
// secret yields a short-lived reset link, with no login required. Because it
// bypasses normal auth it is throttled (a global cap on failures per hour, so
// guessing can't be parallelised across addresses) and every failure looks the
// same — wrong code, non-admin email, and unknown email are indistinguishable.
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json().catch(() => ({})));

    if (!recoveryConfigured()) {
      return NextResponse.json({ error: FAILED }, { status: 403 });
    }

    const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
    if ((await countRecentRecoveryFailures(since)) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in an hour." },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(body.email.toLowerCase());
    // Evaluate the code check regardless of whether the user exists.
    const allowed = recoveryAllowed(body.email, body.code);
    if (!allowed || !user) {
      await recordRecoveryFailure();
      return NextResponse.json({ error: FAILED }, { status: 403 });
    }

    await voidPasswordResets(user.id);
    const { token, hash } = newResetToken();
    await createPasswordReset({
      user_id: user.id,
      token_hash: hash,
      expires_at: new Date(Date.now() + RECOVERY_LINK_TTL_MS).toISOString(),
    });
    return NextResponse.json({ url: `/reset?token=${token}` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: FAILED }, { status: 400 });
    }
    console.error("recover error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
