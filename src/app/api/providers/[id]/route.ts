import { deleteProvider, getProvider, updateProvider } from "@/lib/server/repo/providers";
import { getSettings, updateSettings } from "@/lib/server/repo/settings";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const p = getProvider((await ctx.params).id);
  return p ? ok(p) : fail("Not found", 404);
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await req.json();
  if (id === "mock" && (b.type || b.baseUrl)) return fail("演示服务商不可修改类型");
  const p = updateProvider(id, b);
  return p ? ok(p) : fail("Not found", 404);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  deleteProvider(id);
  const s = getSettings();
  const patch: Parameters<typeof updateSettings>[0] = {};
  if (s.activeModel?.providerId === id) patch.activeModel = null;
  const tm = { ...s.taskModels };
  let changed = false;
  for (const k of Object.keys(tm) as (keyof typeof tm)[]) {
    if (tm[k]?.providerId === id) {
      tm[k] = null;
      changed = true;
    }
  }
  if (changed) patch.taskModels = tm;
  if (Object.keys(patch).length) updateSettings(patch);
  return ok({ ok: true });
});
