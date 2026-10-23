import { testProvider } from "@/lib/server/llm";
import { getProvider } from "@/lib/server/repo/providers";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = getProvider(id);
  if (!p) return fail("Not found", 404);
  const b = (await req.json().catch(() => ({}))) as { modelId?: string };
  const modelId = b.modelId ?? p.models.find((m) => m.enabled)?.modelId;
  if (!modelId) return fail("请先添加至少一个模型再测试");
  try {
    const r = await testProvider(id, modelId);
    return ok({ ok: true, modelId, ...r });
  } catch (e) {
    return ok({ ok: false, modelId, error: (e as Error).message });
  }
});
