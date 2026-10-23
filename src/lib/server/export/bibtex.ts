import type { Paper } from "@/lib/shared/types";

const LATEX_ESC: [RegExp, string][] = [
  [/\\/g, "\\textbackslash{}"],
  [/([&%$#_{}])/g, "\\$1"],
  [/~/g, "\\textasciitilde{}"],
  [/\^/g, "\\textasciicircum{}"],
];

export function bibEscape(s: string): string {
  let out = s;
  for (const [re, rep] of LATEX_ESC) out = out.replace(re, rep);
  return out;
}

export function citeKey(p: Pick<Paper, "authors" | "year" | "title">, used: Set<string> = new Set()): string {
  const first = p.authors[0] ?? "anon";
  const last = (first.includes(",") ? first.split(",")[0] : first.trim().split(/\s+/).pop() ?? "anon")
    .normalize("NFKD")
    .replace(/[^\w]/g, "")
    .toLowerCase() || "anon";
  const word =
    p.title
      .normalize("NFKD")
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, "").toLowerCase())
      .find((w) => w.length > 3 && !["with", "from", "that", "this", "towards", "using"].includes(w)) ?? "paper";
  const base = `${last}${p.year ?? ""}${word}`;
  let key = base;
  let n = 1;
  while (used.has(key)) key = `${base}${String.fromCharCode(96 + ++n)}`;
  used.add(key);
  return key;
}

export function toBibtex(papers: Paper[]): string {
  const used = new Set<string>();
  return papers
    .map((p) => {
      const isArxivOnly = !!p.arxivId && (!p.venue || /^arxiv/i.test(p.venue));
      const type = isArxivOnly ? "misc" : p.venue ? "article" : "misc";
      const fields: [string, string | null | undefined][] = [
        ["title", `{${bibEscape(p.title)}}`],
        ["author", p.authors.length ? bibEscape(p.authors.join(" and ")) : null],
        ["year", p.year ? String(p.year) : null],
        [type === "article" ? "journal" : "howpublished", p.venue && !isArxivOnly ? bibEscape(p.venue) : isArxivOnly ? `arXiv preprint arXiv:${p.arxivId}` : null],
        ["doi", p.doi],
        ["eprint", p.arxivId],
        ["archivePrefix", p.arxivId ? "arXiv" : null],
        ["url", p.url ?? (p.arxivId ? `https://arxiv.org/abs/${p.arxivId}` : p.doi ? `https://doi.org/${p.doi}` : null)],
      ];
      const body = fields
        .filter(([, v]) => v)
        .map(([k, v]) => `  ${k} = {${v}}`)
        .join(",\n");
      return `@${type}{${citeKey(p, used)},\n${body}\n}`;
    })
    .join("\n\n");
}
