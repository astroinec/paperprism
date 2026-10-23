import { extractText, getDocumentProxy, getMeta } from "unpdf";

export interface ParsedPdf {
  pages: string[];
  title: string | null;
  authors: string[];
  arxivId: string | null;
  doi: string | null;
  year: number | null;
  abstract: string | null;
  hasText: boolean;
}

export function cleanPageText(t: string): string {
  return t
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const ARXIV_RE = /arXiv:\s?(\d{4}\.\d{4,5}(?:v\d+)?)/i;
export const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+[^\s"<>.,;)\]])/;

function guessAbstract(first: string): string | null {
  const m = first.match(/abstract[\s.:—-]*([\s\S]{100,2000}?)(?:\n\s*\n|\b1\.?\s+introduction|\bintroduction\b|\bkeywords\b|index terms)/i);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  const zh = first.match(/摘\s*要[：:\s]*([\s\S]{60,1500}?)(?:关键词|关键字|\n\s*\n)/);
  return zh ? zh[1].replace(/\s+/g, " ").trim() : null;
}

function guessTitle(first: string): string | null {
  const lines = first
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && l.length < 220 && !/arxiv|preprint|proceedings|conference|journal|copyright|licen[cs]e|http|@/i.test(l));
  return lines[0] ?? null;
}

export async function parsePdf(buf: Uint8Array): Promise<ParsedPdf> {
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map(cleanPageText);
  let metaTitle: string | null = null;
  let metaAuthor: string | null = null;
  try {
    const meta = await getMeta(pdf);
    const info = meta.info as Record<string, unknown>;
    if (typeof info?.Title === "string" && info.Title.trim().length > 5 && !/^microsoft word|untitled|\.dvi$|\.pdf$/i.test(info.Title.trim())) {
      metaTitle = info.Title.trim();
    }
    if (typeof info?.Author === "string" && info.Author.trim()) metaAuthor = info.Author.trim();
  } catch {
    /* ignore */
  }
  const first = pages[0] ?? "";
  const head = pages.slice(0, 2).join("\n");
  const totalChars = pages.reduce((a, p) => a + p.length, 0);
  const arxiv = head.match(ARXIV_RE)?.[1] ?? null;
  const doi = head.match(DOI_RE)?.[1] ?? null;
  const years = [...head.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]));
  return {
    pages,
    title: metaTitle ?? guessTitle(first),
    authors: metaAuthor ? metaAuthor.split(/\s*(?:,|;| and )\s*/).filter(Boolean) : [],
    arxivId: arxiv,
    doi,
    year: years.length ? Math.max(...years.filter((y) => y <= new Date().getFullYear())) || null : null,
    abstract: guessAbstract(head),
    hasText: totalChars > Math.max(200, pages.length * 30),
  };
}
