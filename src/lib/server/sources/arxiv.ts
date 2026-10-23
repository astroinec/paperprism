import { XMLParser } from "fast-xml-parser";
import type { SearchResult } from "@/lib/shared/types";

const UA = "PaperPrism/0.1 (local research tool)";

type Entry = {
  id: string;
  title: string;
  summary: string;
  published: string;
  author: { name: string } | { name: string }[];
  link: { "@_href": string; "@_title"?: string; "@_type"?: string } | { "@_href": string; "@_title"?: string; "@_type"?: string }[];
  "arxiv:doi"?: string | { "#text": string };
  "arxiv:journal_ref"?: string | { "#text": string };
  "arxiv:primary_category"?: { "@_term": string };
};

const text = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as object)) return String((v as { "#text": unknown })["#text"]);
  return String(v);
};

export function parseArxivAtom(xml: string): SearchResult[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);
  const raw = doc?.feed?.entry;
  const entries: Entry[] = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  return entries
    .filter((e) => e && e.id && e.title)
    .map((e) => {
      const idUrl = String(e.id);
      const arxivId = idUrl.split("/abs/")[1] ?? idUrl;
      const authors = (Array.isArray(e.author) ? e.author : e.author ? [e.author] : []).map((a) => String(a.name));
      const links = Array.isArray(e.link) ? e.link : e.link ? [e.link] : [];
      const pdf = links.find((l) => l["@_title"] === "pdf" || l["@_type"] === "application/pdf")?.["@_href"] ?? `https://arxiv.org/pdf/${arxivId}`;
      return {
        source: "arxiv" as const,
        externalId: arxivId,
        title: String(e.title).replace(/\s+/g, " ").trim(),
        authors,
        year: e.published ? Number(String(e.published).slice(0, 4)) : null,
        venue: text(e["arxiv:journal_ref"]) ?? (e["arxiv:primary_category"]?.["@_term"] ? `arXiv · ${e["arxiv:primary_category"]["@_term"]}` : "arXiv"),
        abstract: String(e.summary ?? "").replace(/\s+/g, " ").trim(),
        doi: text(e["arxiv:doi"]),
        arxivId,
        pdfUrl: pdf.replace(/^http:/, "https:"),
        url: idUrl.replace(/^http:/, "https:"),
        citationCount: null,
      };
    });
}

export async function searchArxiv(q: string, max = 15): Promise<SearchResult[]> {
  const isId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(q.trim());
  const url = isId
    ? `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(q.trim())}`
    : `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(
        q
          .trim()
          .split(/\s+/)
          .map((w) => `all:${w}`)
          .join("+AND+"),
      ).replace(/%2B/g, "+")}&start=0&max_results=${max}&sortBy=relevance`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  return parseArxivAtom(await res.text());
}

export async function getArxiv(id: string): Promise<SearchResult | null> {
  const r = await searchArxiv(id.replace(/v\d+$/, ""));
  return r[0] ?? null;
}

export function parseArxivId(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i) ??
    s.match(/^arxiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)$/i) ??
    s.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/);
  return m ? m[1] : null;
}
