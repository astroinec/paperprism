import ExcelJS from "exceljs";
import type { Cell, Dimension, Paper } from "@/lib/shared/types";

export async function matrixXlsx(name: string, papers: Paper[], dims: Dimension[], cells: Cell[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PaperPrism";
  wb.created = new Date();

  const ws = wb.addWorksheet("Matrix", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  ws.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Paper", key: "title", width: 40 },
    { header: "Year", key: "year", width: 8 },
    ...dims.map((d) => ({ header: d.name, key: d.id, width: 36 })),
  ];
  papers.forEach((p, i) => {
    const row: Record<string, string | number> = { id: `P${i + 1}`, title: p.title, year: p.year ?? "" };
    for (const d of dims) {
      const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id && x.status === "done");
      row[d.id] = c ? (d.type === "number" || d.type === "rating") && c.numeric != null ? c.numeric : c.value : "";
    }
    ws.addRow(row);
  });
  if (dims.some((d) => d.summary)) {
    const r = ws.addRow({ id: "", title: "Insight", ...Object.fromEntries(dims.map((d) => [d.id, d.summary ?? ""])) });
    r.font = { italic: true, color: { argb: "FF555555" } };
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A84FF" } };
  header.height = 22;
  ws.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });

  const ev = wb.addWorksheet("Evidence");
  ev.columns = [
    { header: "Paper", key: "paper", width: 8 },
    { header: "Dimension", key: "dim", width: 20 },
    { header: "Value", key: "value", width: 40 },
    { header: "Page", key: "page", width: 6 },
    { header: "Quote", key: "quote", width: 70 },
    { header: "Source", key: "source", width: 10 },
    { header: "Confidence", key: "conf", width: 10 },
    { header: "Verified", key: "verified", width: 9 },
  ];
  papers.forEach((p, i) => {
    for (const d of dims) {
      const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id && x.status === "done");
      if (!c) continue;
      ev.addRow({
        paper: `P${i + 1}`,
        dim: d.name,
        value: c.value,
        page: c.page ?? "",
        quote: c.quote ?? "",
        source: c.source ?? "",
        conf: c.confidence ?? "",
        verified: c.verified ? "✓" : "",
      });
    }
  });
  ev.getRow(1).font = { bold: true };
  ev.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });

  const info = wb.addWorksheet("Papers");
  info.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Title", key: "title", width: 50 },
    { header: "Authors", key: "authors", width: 40 },
    { header: "Year", key: "year", width: 8 },
    { header: "Venue", key: "venue", width: 24 },
    { header: "DOI", key: "doi", width: 24 },
    { header: "arXiv", key: "arxiv", width: 14 },
  ];
  papers.forEach((p, i) =>
    info.addRow({ id: `P${i + 1}`, title: p.title, authors: p.authors.join("; "), year: p.year ?? "", venue: p.venue ?? "", doi: p.doi ?? "", arxiv: p.arxivId ?? "" }),
  );
  info.getRow(1).font = { bold: true };
  wb.title = name;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
