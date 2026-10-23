import { summarizeDimensions } from "@/lib/server/agents/dimensions";
import { handle, langOf, ok, type Ctx } from "@/lib/server/http";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  return ok({ summaries: await summarizeDimensions(id, langOf(b.lang)) });
});
