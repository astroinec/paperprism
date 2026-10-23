import { getProjectDetail } from "@/lib/server/repo/projects";
import { matrixCsv, matrixMarkdownDoc } from "@/lib/server/export/markdown";
import { matrixXlsx } from "@/lib/server/export/xlsx";
import { download, fail, handle, safeName, type Ctx } from "@/lib/server/http";

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const p = getProjectDetail((await ctx.params).id);
  if (!p) return fail("Not found", 404);
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  const base = safeName(`${p.name}-matrix`);
  if (format === "csv") return download(matrixCsv(p.papers, p.dimensions, p.cells), `${base}.csv`, "text/csv; charset=utf-8");
  if (format === "md") return download(matrixMarkdownDoc(p.name, p.papers, p.dimensions, p.cells), `${base}.md`, "text/markdown; charset=utf-8");
  const buf = await matrixXlsx(p.name, p.papers, p.dimensions, p.cells);
  return download(new Uint8Array(buf), `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});
