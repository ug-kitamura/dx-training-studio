import { z } from "zod";
import { generateSessionTitle } from "@/lib/agent/generate-session-title";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const hasAssistant = parsed.data.messages.some(
    (message) => message.role === "assistant",
  );
  if (!hasAssistant) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await generateSessionTitle(req, parsed.data.messages);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ title: result.title });
}
