import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { createResetRequest, findUserByEmail, listUsers } from "@/lib/data";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email("Enter a valid email") });

// Public: "I forgot my password". Notifies the admin, who issues a reset link.
// The response is IDENTICAL whether or not the email has an account, so this
// can't be used to discover who is registered.
export async function POST(req: Request) {
  try {
    const { email } = schema.parse(await req.json().catch(() => ({})));
    const user = await findUserByEmail(email.toLowerCase());
    if (user && (await createResetRequest(user.id))) {
      const admins = (await listUsers()).filter((u) => isAdmin(u.email));
      await Promise.all(
        admins.map((a) =>
          sendPushToUser(a.id, {
            title: "🔑 Password reset requested",
            body: `${user.name} (${user.email}) can't log in. Create a reset link in Settings.`,
            url: "/settings",
          }).catch(() => 0)
        )
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("forgot error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
