import { resolveModelLabel } from "@/lib/agent/model-labels";
import { resolveAnthropicModel } from "@/lib/agent/anthropic-stream";

export async function GET() {
  const model = resolveAnthropicModel();
  return Response.json({
    model,
    modelLabel: resolveModelLabel(model),
  });
}
