import { getDb, json } from "../db";
import { newId } from "../ids";
import type { Paper, PaperSource, PaperStatus } from "@/lib/shared/types";

interface PaperRow {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxiv_id: string | null;
  abstract: string | null;
  url: string | null;
  source: PaperSource;
  file_path: string | null;
  num_pages: number;
  status: PaperStatus;
  error: string | null;
  tags: string;
  citation_count: number | null;
  created_at: number;
}

export const toPaper = (r: PaperRow): Paper => ({
  id: r.id,
  title: r.title,
  authors: json<string[]>(r.authors, []),
  year: r.year,
  venue: r.venue,
  doi: r.doi,
  arxivId: r.arxiv_id,
  abstract: r.abstract,
  url: r.url,
  source: r.source,
  hasFile: !!r.file_path,
  numPages: r.num_pages,
  status: r.status,
  error: r.error,
  tags: json<string[]>(r.tags, []),
  citationCount: r.citation_count,
  createdAt: r.created_at,
});

export function listPapers(): Paper[] {
  return (getDb().prepare("SELECT * FROM papers ORDER BY created_at DESC").all() as PaperRow[]).map(toPaper);
}

export function getPaper(id: string): Paper | null {
  const r = getDb().prepare("SELECT * FROM papers WHERE id=?").get(id) as PaperRow | undefined;
  return r ? toPaper(r) : null;
}

export function getPaperFilePath(id: string): string | null {
  const r = getDb().prepare("SELECT file_path FROM papers WHERE id=?").get(id) as { file_path: string | null } | undefined;
  return r?.file_path ?? null;
}

export function findPaperByArxiv(arxivId: string): Paper | null {
  const base = arxivId.replace(/v\d+$/, "");
  const r = getDb()
    .prepare("SELECT * FROM papers WHERE arxiv_id=? OR arxiv_id LIKE ?")
    .get(base, `${base}v%`) as PaperRow | undefined;
  return r ? toPaper(r) : null;
}

export interface NewPaper {
  title: string;
  authors?: string[];
  year?: number | null;
  venue?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  abstract?: string | null;
  url?: string | null;
  source: PaperSource;
  filePath?: string | null;
  pages?: string[];
  status?: PaperStatus;
  error?: string | null;
  citationCount?: number | null;
}

export function insertPaper(p: NewPaper): Paper {
  const db = getDb();
  const id = newId();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO papers (id,title,authors,year,venue,doi,arxiv_id,abstract,url,source,file_path,num_pages,status,error,tags,citation_count,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'[]',?,?)`,
    ).run(
      id,
      p.title || "Untitled",
      JSON.stringify(p.authors ?? []),
      p.year ?? null,
      p.venue ?? null,
      p.doi ?? null,
      p.arxivId ?? null,
      p.abstract ?? null,
      p.url ?? null,
      p.source,
      p.filePath ?? null,
      p.pages?.length ?? 0,
      p.status ?? "ready",
      p.error ?? null,
      p.citationCount ?? null,
      Date.now(),
    );
    if (p.pages?.length) {
      const stmt = db.prepare("INSERT INTO pages (paper_id,page_no,text) VALUES (?,?,?)");
      p.pages.forEach((t, i) => stmt.run(id, i + 1, t));
    }
  });
  tx();
  return getPaper(id)!;
}

export function updatePaper(
  id: string,
  patch: Partial<{ title: string; authors: string[]; year: number | null; venue: string | null; doi: string | null; abstract: string | null; tags: string[] }>,
) {
  const map: Record<string, string> = { title: "title", year: "year", venue: "venue", doi: "doi", abstract: "abstract" };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) (sets.push(`${col}=?`), vals.push((patch as Record<string, unknown>)[k] ?? null));
  }
  if (patch.authors) (sets.push("authors=?"), vals.push(JSON.stringify(patch.authors)));
  if (patch.tags) (sets.push("tags=?"), vals.push(JSON.stringify(patch.tags)));
  if (sets.length) getDb().prepare(`UPDATE papers SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
  return getPaper(id);
}

export function deletePaper(id: string) {
  getDb().prepare("DELETE FROM papers WHERE id=?").run(id);
}

export function getPages(paperId: string): string[] {
  const rows = getDb().prepare("SELECT text FROM pages WHERE paper_id=? ORDER BY page_no").all(paperId) as { text: string }[];
  return rows.map((r) => r.text);
}
