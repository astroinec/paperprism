import type { Cell, Dimension, Paper } from "@/lib/shared/types";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

export function matrixMarkdown(papers: Paper[], dims: Dimension[], cells: Cell[], opts: { withPages?: boolean } = {}): string {
  const header = `| Paper | ${dims.map((d) => esc(d.name)).join(" | ")} |`;
  const sep = `|---|${dims.map(() => "---").join("|")}|`;
  const rows = papers.map((p, i) => {
    const vals = dims.map((d) => {
      const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id);
      if (!c || c.status !== "done") return "—";
      return esc(c.value) + (opts.withPages && c.page ? ` (p.${c.page})` : "");
    });
    return `| P${i + 1}: ${esc(p.title)}${p.year ? ` (${p.year})` : ""} | ${vals.join(" | ")} |`;
  });
  return [header, sep, ...rows].join("\n");
}

export function matrixMarkdownDoc(name: string, papers: Paper[], dims: Dimension[], cells: Cell[]): string {
  const parts = [`# ${name}`, "", matrixMarkdown(papers, dims, cells, { withPages: true }), ""];
  const sums = dims.filter((d) => d.summary);
  if (sums.length) {
    parts.push("## Dimension Insights", "");
    for (const d of sums) parts.push(`- **${d.name}**: ${d.summary}`);
    parts.push("");
  }
  parts.push("## Evidence", "");
  papers.forEach((p, i) => {
    parts.push(`### P${i + 1}. ${p.title}`, "");
    for (const d of dims) {
      const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id);
      if (c?.quote) parts.push(`- **${d.name}** (p.${c.page ?? "?"}): > ${c.quote.replace(/\n+/g, " ")}`);
    }
    parts.push("");
  });
  return parts.join("\n");
}

export function csvEscape(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function matrixCsv(papers: Paper[], dims: Dimension[], cells: Cell[]): string {
  const head = ["ID", "Title", "Year", "Authors", ...dims.flatMap((d) => [d.name, `${d.name} (page)`, `${d.name} (quote)`])];
  const rows = papers.map((p, i) => [
    `P${i + 1}`,
    p.title,
    p.year ? String(p.year) : "",
    p.authors.join("; "),
    ...dims.flatMap((d) => {
      const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id && x.status === "done");
      return [c?.value ?? "", c?.page ? String(c.page) : "", c?.quote ?? ""];
    }),
  ]);
  return "\uFEFF" + [head, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
