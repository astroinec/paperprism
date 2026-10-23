import { listPapers } from "@/lib/server/repo/papers";
import { getProject, getProjectPapers } from "@/lib/server/repo/projects";
import { toBibtex } from "@/lib/server/export/bibtex";
import { download, handle, safeName } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const projectId = sp.get("projectId");
  const ids = sp.get("ids")?.split(",").filter(Boolean);
  let papers = projectId ? getProjectPapers(projectId) : listPapers();
  if (ids?.length) papers = papers.filter((p) => ids.includes(p.id));
  const name = projectId ? (getProject(projectId)?.name ?? "project") : "library";
  return download(toBibtex(papers) + "\n", `${safeName(name)}.bib`, "application/x-bibtex; charset=utf-8");
});
