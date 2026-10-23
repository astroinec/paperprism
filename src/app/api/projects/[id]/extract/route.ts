import { extractForPaper } from "@/lib/server/agents/extract";
import { fail, handle, langOf, ok, type Ctx } from "@/lib/server/http";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { paperId?: string; dimensionIds?: string[]; lang?: string };
  if (!b.paperId) return fail("paperId required");
  return ok({ cells: await extractForPaper({ projectId: id, paperId: b.paperId, dimensionIds: b.dimensionIds, lang: langOf(b.lang) }) });
});
