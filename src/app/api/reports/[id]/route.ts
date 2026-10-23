import { deleteReport, getReport, updateReport } from "@/lib/server/repo/content";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const r = getReport((await ctx.params).id);
  return r ? ok(r) : fail("Not found", 404);
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const b = (await req.json()) as { content?: string };
  const r = updateReport((await ctx.params).id, { content: b.content });
  return r ? ok(r) : fail("Not found", 404);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteReport((await ctx.params).id);
  return ok({ ok: true });
});
