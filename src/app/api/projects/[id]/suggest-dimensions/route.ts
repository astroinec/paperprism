import { suggestDimensions } from "@/lib/server/agents/dimensions";
import { handle, langOf, ok, type Ctx } from "@/lib/server/http";

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  return ok({ dimensions: await suggestDimensions(id, langOf(b.lang)) });
});
