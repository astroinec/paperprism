import { getReport } from "@/lib/server/repo/content";
import { getProject, getProjectPapers } from "@/lib/server/repo/projects";
import { markdownToDocx } from "@/lib/server/export/docx";
import { download, fail, handle, safeName, type Ctx } from "@/lib/server/http";

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const r = getReport((await ctx.params).id);
  if (!r) return fail("Not found", 404);
  const project = getProject(r.projectId);
  const papers = getProjectPapers(r.projectId);
  const title = `${project?.name ?? "Report"}`;
  const refs = papers
    .map((p, i) => `${i + 1}. [P${i + 1}] ${p.authors.slice(0, 3).join(", ")}${p.authors.length > 3 ? " et al." : ""}. ${p.title}. ${p.venue ?? ""} ${p.year ?? ""}`.trim())
    .join("\n");
  const md = `${r.content}\n\n## ${r.language === "zh" ? "参考文献" : "References"}\n\n${refs}\n`;
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const base = safeName(`${title}-report`);
  if (format === "docx") {
    const buf = await markdownToDocx(title, md);
    return download(new Uint8Array(buf), `${base}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }
  return download(`# ${title}\n\n${md}`, `${base}.md`, "text/markdown; charset=utf-8");
});
