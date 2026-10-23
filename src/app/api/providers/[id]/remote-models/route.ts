import { listRemoteModels } from "@/lib/server/llm";
import { handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return ok({ models: await listRemoteModels(id) });
});
