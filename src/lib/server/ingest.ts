import fs from "node:fs/promises";
import path from "node:path";
import { FILES_DIR, ensureDirs } from "./paths";
import { newId } from "./ids";
import { parsePdf } from "./pdf";
import { findPaperByArxiv, insertPaper, type NewPaper } from "./repo/papers";
import { getArxiv, parseArxivId } from "./sources/arxiv";
import { getCrossref, getS2 } from "./sources/s2";
import { DOI_RE } from "./pdf";
import type { Paper, PaperSource, SearchResult } from "@/lib/shared/types";

const MAX_PDF = 60 * 1024 * 1024;

async function saveFile(buf: Uint8Array): Promise<string> {
  ensureDirs();
  const file = path.join(FILES_DIR, `${newId()}.pdf`);
  await fs.writeFile(file, buf);
  return file;
}

function isPdf(buf: Uint8Array) {
  return buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

export async function downloadPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 PaperPrism/0.1", Accept: "application/pdf,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`下载 PDF 失败 (${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_PDF) throw new Error("PDF 文件过大");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!isPdf(buf)) throw new Error("链接内容不是 PDF 文件");
  return buf;
}

export async function ingestPdf(buf: Uint8Array, opts: { fileName?: string; meta?: Partial<NewPaper>; source?: PaperSource } = {}): Promise<Paper> {
  if (!isPdf(buf)) throw new Error("不是有效的 PDF 文件");
  if (buf.length > MAX_PDF) throw new Error("PDF 文件过大（上限 60MB）");
  const filePath = await saveFile(buf);
  try {
    const parsed = await parsePdf(new Uint8Array(buf));
    let meta: Partial<NewPaper> = { ...opts.meta };
    if (!meta.title && parsed.arxivId) {
      const existing = findPaperByArxiv(parsed.arxivId);
      if (existing) {
        await fs.unlink(filePath).catch(() => {});
        return existing;
      }
      const ax = await getArxiv(parsed.arxivId).catch(() => null);
      if (ax) meta = { ...fromSearch(ax), ...meta };
    }
    if (!meta.title && parsed.doi) {
      const cr = await getCrossref(parsed.doi).catch(() => null);
      if (cr) meta = { ...fromSearch(cr), ...meta };
    }
    const fallbackTitle = opts.fileName?.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") ?? "Untitled";
    return insertPaper({
      source: opts.source ?? "upload",
      ...meta,
      title: meta.title || parsed.title || fallbackTitle,
      authors: meta.authors?.length ? meta.authors : parsed.authors,
      year: meta.year ?? parsed.year,
      abstract: meta.abstract || parsed.abstract,
      arxivId: meta.arxivId ?? parsed.arxivId,
      doi: meta.doi ?? parsed.doi,
      filePath,
      pages: parsed.pages,
      status: parsed.hasText ? "ready" : "no_text",
      error: parsed.hasText ? null : "PDF 没有可提取的文本层（可能是扫描件）",
    });
  } catch (e) {
    return insertPaper({
      source: opts.source ?? "upload",
      ...opts.meta,
      title: opts.meta?.title || opts.fileName || "Untitled",
      filePath,
      status: "error",
      error: `解析失败：${(e as Error).message}`,
    });
  }
}

function fromSearch(r: SearchResult): Partial<NewPaper> {
  return {
    title: r.title,
    authors: r.authors,
    year: r.year,
    venue: r.venue,
    doi: r.doi,
    arxivId: r.arxivId,
    abstract: r.abstract,
    url: r.url,
    citationCount: r.citationCount,
  };
}

function textPages(text: string, size = 3500): string[] {
  const out: string[] = [];
  const paras = text.split(/\n\s*\n/);
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > size && cur) {
      out.push(cur.trim());
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [text];
}

export async function importSearchResult(r: SearchResult): Promise<{ paper: Paper; warning?: string }> {
  if (r.arxivId) {
    const existing = findPaperByArxiv(r.arxivId);
    if (existing) return { paper: existing, warning: "already_exists" };
  }
  const source: PaperSource = r.source === "arxiv" ? "arxiv" : "s2";
  if (r.pdfUrl) {
    try {
      const buf = await downloadPdf(r.pdfUrl);
      return { paper: await ingestPdf(buf, { meta: fromSearch(r), source }) };
    } catch (e) {
      const paper = insertPaper({
        ...fromSearch(r),
        title: r.title,
        source,
        pages: r.abstract ? [`${r.title}\n\nAbstract\n${r.abstract}`] : [],
        status: r.abstract ? "ready" : "no_text",
      });
      return { paper, warning: `pdf_failed: ${(e as Error).message}` };
    }
  }
  const paper = insertPaper({
    ...fromSearch(r),
    title: r.title,
    source,
    pages: r.abstract ? [`${r.title}\n\nAbstract\n${r.abstract}`] : [],
    status: r.abstract ? "ready" : "no_text",
  });
  return { paper, warning: "abstract_only" };
}

export async function importByUrl(input: string): Promise<{ paper: Paper; warning?: string }> {
  const s = input.trim();
  const ax = parseArxivId(s);
  if (ax) {
    const r = await getArxiv(ax);
    if (!r) throw new Error(`未找到 arXiv 论文 ${ax}`);
    return importSearchResult(r);
  }
  const doi = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").match(DOI_RE)?.[1];
  if (doi && !/\.pdf$/i.test(s)) {
    const s2 = await getS2(`DOI:${doi}`).catch(() => null);
    const cr = s2 ?? (await getCrossref(doi));
    if (!cr) throw new Error(`未找到 DOI ${doi}`);
    return importSearchResult(cr);
  }
  if (/^https?:\/\//i.test(s)) {
    const buf = await downloadPdf(s);
    return { paper: await ingestPdf(buf, { fileName: decodeURIComponent(s.split("/").pop() ?? ""), meta: { url: s }, source: "url" }) };
  }
  throw new Error("无法识别的链接，请输入 arXiv 链接/ID、DOI 或 PDF 直链");
}

export function importText(input: { title: string; text: string; authors?: string[]; year?: number | null }): Paper {
  const pages = textPages(input.text.trim());
  const abs = input.text.match(/abstract[\s.:]*([\s\S]{80,1500}?)(?:\n\s*\n|$)/i)?.[1] ?? input.text.slice(0, 800);
  return insertPaper({
    title: input.title || input.text.split("\n")[0].slice(0, 200) || "Untitled",
    authors: input.authors ?? [],
    year: input.year ?? null,
    abstract: abs.replace(/\s+/g, " ").trim(),
    source: "text",
    pages,
    status: pages.join("").length > 50 ? "ready" : "no_text",
  });
}
