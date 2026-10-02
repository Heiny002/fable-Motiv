import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import {
  createPasswordReset,
  findUserByEmail,
  markResetRequestsHandled,
  voidPasswordResets,
} from "@/lib/data";
import { newResetToken, RESET_TTL_MS } from "@/lib/resetToken";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email("Valid email required") });

// Admin-only: mint a single-use, 1-hour password reset link for a user. There's
// no email service wired up, so the admin hands the link over directly.
export const POST = withUser(async (user, req) => {
  if (!isAdmin(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await parseBody(req, schema);
  const target = await findUserByEmail(email.toLowerCase());
  if (!target) return NextResponse.json({ error: "No account with that email." }, { status: 404 });

  // Only one live link per user at a time.
  await voidPasswordResets(target.id);
  const { token, hash } = newResetToken();
  const expires = new Date(Date.now() + RESET_TTL_MS);
  await createPasswordReset({ user_id: target.id, token_hash: hash, expires_at: expires.toISOString() });

  // A link is out, so any open "forgot password" request from them is handled.
  await markResetRequestsHandled(target.id);

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    url: `${origin}/reset?token=${token}`,
    expires_at: expires.toISOString(),
    name: target.name,
  });
});
