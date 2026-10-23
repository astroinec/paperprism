import { deleteProject, getProjectDetail, updateProject } from "@/lib/server/repo/projects";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const p = getProjectDetail((await ctx.params).id);
  return p ? ok(p) : fail("Not found", 404);
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const p = updateProject((await ctx.params).id, await req.json());
  return p ? ok(p) : fail("Not found", 404);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteProject((await ctx.params).id);
  return ok({ ok: true });
});
