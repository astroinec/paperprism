import { deleteModel, updateModel } from "@/lib/server/repo/providers";
import { handle, ok, type Ctx } from "@/lib/server/http";

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  updateModel((await ctx.params).id, await req.json());
  return ok({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteModel((await ctx.params).id);
  return ok({ ok: true });
});
