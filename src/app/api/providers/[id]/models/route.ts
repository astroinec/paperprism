import { addModels, getProvider } from "@/lib/server/repo/providers";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { modelIds?: string[] };
  if (!b.modelIds?.length) return fail("请提供模型 ID");
  addModels(id, b.modelIds);
  return ok(getProvider(id));
});
