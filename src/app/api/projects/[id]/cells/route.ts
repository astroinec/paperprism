import { getCell, touchProject, upsertCell } from "@/lib/server/repo/projects";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";
import { parseNumber } from "@/lib/shared/utils";

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { paperId: string; dimensionId: string; value: string; numeric?: number | null };
  if (!b.paperId || !b.dimensionId) return fail("paperId & dimensionId required");
  const prev = getCell(id, b.paperId, b.dimensionId);
  upsertCell({
    projectId: id,
    paperId: b.paperId,
    dimensionId: b.dimensionId,
    value: b.value ?? "",
    numeric: b.numeric !== undefined ? b.numeric : parseNumber(b.value),
    quote: prev?.quote ?? null,
    page: prev?.page ?? null,
    confidence: "high",
    source: prev?.source ?? "stated",
    verified: prev?.verified ?? false,
    status: "done",
    error: null,
    edited: true,
    model: prev?.model ?? null,
  });
  touchProject(id);
  return ok(getCell(id, b.paperId, b.dimensionId));
});
