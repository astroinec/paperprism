import { getProjectDetail, setProjectPapers } from "@/lib/server/repo/projects";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { paperIds?: string[] };
  if (!Array.isArray(b.paperIds)) return fail("paperIds required");
  setProjectPapers(id, b.paperIds);
  return ok(getProjectDetail(id));
});
