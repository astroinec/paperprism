import type { SearchResult } from "@/lib/shared/types";

const FIELDS = "title,authors,year,venue,abstract,citationCount,externalIds,openAccessPdf,url";

interface S2Paper {
  paperId: string;
  title: string;
  authors?: { name: string }[];
  year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  citationCount?: number | null;
  externalIds?: { DOI?: string; ArXiv?: string } | null;
  openAccessPdf?: { url?: string } | null;
  url?: string | null;
}

const toResult = (p: S2Paper): SearchResult => ({
  source: "s2",
  externalId: p.paperId,
  title: p.title,
  authors: (p.authors ?? []).map((a) => a.name),
  year: p.year ?? null,
  venue: p.venue || null,
  abstract: p.abstract ?? null,
  doi: p.externalIds?.DOI ?? null,
  arxivId: p.externalIds?.ArXiv ?? null,
  pdfUrl: p.openAccessPdf?.url || (p.externalIds?.ArXiv ? `https://arxiv.org/pdf/${p.externalIds.ArXiv}` : null),
  url: p.url ?? null,
  citationCount: p.citationCount ?? null,
});

function headers() {
  const h: Record<string, string> = {};
  if (process.env.S2_API_KEY) h["x-api-key"] = process.env.S2_API_KEY;
  return h;
}

export async function searchS2(q: string, limit = 15): Promise<SearchResult[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&fields=${FIELDS}`;
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(20000) });
  if (res.status === 429) throw new Error("Semantic Scholar 请求过于频繁，请稍后再试（429）");
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}`);
  const j = (await res.json()) as { data?: S2Paper[] };
  return (j.data ?? []).map(toResult);
}

export async function getS2(id: string): Promise<SearchResult | null> {
  const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id)}?fields=${FIELDS}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  return toResult((await res.json()) as S2Paper);
}

export async function getCrossref(doi: string): Promise<SearchResult | null> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { "User-Agent": "PaperPrism/0.1 (mailto:local@paperprism.app)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    message: {
      title?: string[];
      author?: { given?: string; family?: string; name?: string }[];
      issued?: { "date-parts"?: number[][] };
      "container-title"?: string[];
      abstract?: string;
      URL?: string;
      "is-referenced-by-count"?: number;
      link?: { URL: string; "content-type"?: string }[];
    };
  };
  const m = j.message;
  return {
    source: "s2",
    externalId: doi,
    title: m.title?.[0] ?? doi,
    authors: (m.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" ")),
    year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
    venue: m["container-title"]?.[0] ?? null,
    abstract: m.abstract ? m.abstract.replace(/<[^>]+>/g, "").trim() : null,
    doi,
    arxivId: null,
    pdfUrl: m.link?.find((l) => l["content-type"] === "application/pdf")?.URL ?? null,
    url: m.URL ?? `https://doi.org/${doi}`,
    citationCount: m["is-referenced-by-count"] ?? null,
  };
}
