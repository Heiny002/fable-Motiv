import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { coachTurn } from "@/lib/coach/engine";
import { recentMessages } from "@/lib/data";
import { capMessage, takeUsage } from "@/lib/usage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ message: z.string().min(1).max(4000) });

// GET: chat history
export const GET = withUser(async (user) => {
  const messages = await recentMessages(user.id, 120);
  return NextResponse.json({
    // Skip tool-only rows (tool_result turns are stored with empty text) so the
    // UI shows only real conversation.
    messages: messages
      .filter((m) => m.content && m.content.trim() !== "")
      .map((m) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })),
  });
});

// POST: one coach turn, streamed back as SSE
export const POST = withUser(async (user, req) => {
  const { message } = await parseBody(req, schema);

  const usage = await takeUsage(user, "chat");
  if (!usage.ok) {
    return NextResponse.json(
      { error: capMessage(usage), code: "daily_cap", resets_at: usage.resetsAt ?? null },
      { status: 429 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of coachTurn(user, message)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (err) {
        console.error("chat stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", text: "stream failed" })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
