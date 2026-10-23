import fs from "node:fs/promises";
import { deletePaper, getPages, getPaper, getPaperFilePath, updatePaper } from "@/lib/server/repo/papers";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = getPaper(id);
  if (!p) return fail("Not found", 404);
  const withPages = new URL(req.url).searchParams.get("pages") === "1";
  return ok(withPages ? { ...p, pages: getPages(id) } : p);
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const p = updatePaper((await ctx.params).id, await req.json());
  return p ? ok(p) : fail("Not found", 404);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const file = getPaperFilePath(id);
  deletePaper(id);
  if (file) await fs.unlink(file).catch(() => {});
  return ok({ ok: true });
});
