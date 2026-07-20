import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireUser } from "./auth";
import type { PublicUser } from "./types";

type Handler = (user: PublicUser, req: Request, params: Record<string, string>) => Promise<Response>;

/** Wrap an API handler with auth + uniform error handling. */
export function withUser(handler: Handler) {
  return async (req: Request, ctx?: { params?: Record<string, string> }): Promise<Response> => {
    try {
      const user = await requireUser();
      return await handler(user, req, ctx?.params ?? {});
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      console.error("API error:", err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function parseBody<T>(
  req: Request,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}
