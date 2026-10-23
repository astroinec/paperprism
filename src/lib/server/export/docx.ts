import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

function inline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push(new TextRun(text.slice(last, idx)));
    const tok = m[0];
    if (tok.startsWith("**")) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    else if (tok.startsWith("`")) runs.push(new TextRun({ text: tok.slice(1, -1), font: "Menlo" }));
    else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true }));
    last = idx + tok.length;
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)));
  return runs;
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

const splitRow = (l: string) =>
  l
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function markdownToDocxChildren(md: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(new Paragraph({ children: inline(para.join(" ")), spacing: { after: 120 } }));
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      out.push(new Paragraph({ heading: HEADINGS[h[1].length - 1], children: inline(h[2]) }));
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [header, ...rows].map(
            (r, ri) =>
              new TableRow({
                children: header.map(
                  (_, ci) =>
                    new TableCell({
                      children: [new Paragraph({ children: ri === 0 ? [new TextRun({ text: r[ci] ?? "", bold: true })] : inline(r[ci] ?? "") })],
                    }),
                ),
              }),
          ),
        }),
      );
      continue;
    }
    const li = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      out.push(new Paragraph({ bullet: { level: Math.min(3, Math.floor(li[1].length / 2)) }, children: inline(li[2]) }));
      i++;
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flush();
      out.push(new Paragraph({ indent: { left: 480 }, children: [new TextRun({ text: q[1], italics: true, color: "555555" })] }));
      i++;
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
    i++;
  }
  flush();
  return out;
}

export async function markdownToDocx(title: string, md: string): Promise<Buffer> {
  const doc = new Document({
    creator: "PaperPrism",
    title,
    styles: { default: { document: { run: { font: "PingFang SC", size: 22 } } } },
    sections: [{ children: [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }), ...markdownToDocxChildren(md)] }],
  });
  return Packer.toBuffer(doc);
}
