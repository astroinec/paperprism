import MiniSearch from "minisearch";

export interface Chunk {
  id: string;
  paperId: string;
  paperIndex: number;
  page: number;
  text: string;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const STOP = new Set(
  "the a an and or of to in on for with by is are was were be been this that these those we our it its as at from which can has have using use used than also into their more such not".split(
    " ",
  ),
);

/** Latin words (lowercased, stopwords removed) + CJK character bigrams. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9][a-z0-9\-_.]*[a-z0-9]|[a-z0-9]|[\u3400-\u9fff\uf900-\ufaff]+/g)) {
    const w = m[0];
    if (CJK.test(w)) {
      if (w.length === 1) out.push(w);
      for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
    } else if (!STOP.has(w) && w.length > 1) {
      out.push(w);
    }
  }
  return out;
}

export function chunkPages(pages: string[], paperId: string, paperIndex: number, size = 1200, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return;
    let start = 0;
    let n = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        const cut = text.lastIndexOf(". ", end);
        if (cut > start + size * 0.5) end = cut + 1;
      }
      chunks.push({ id: `${paperId}:${i + 1}:${n++}`, paperId, paperIndex, page: i + 1, text: text.slice(start, end).trim() });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });
  return chunks;
}

export function searchChunks(chunks: Chunk[], query: string, k = 8): (Chunk & { score: number })[] {
  if (!chunks.length) return [];
  const ms = new MiniSearch<Chunk>({
    fields: ["text"],
    storeFields: ["id"],
    tokenize,
    processTerm: (t) => t,
    searchOptions: { tokenize, processTerm: (t) => t, combineWith: "OR", prefix: false },
  });
  ms.addAll(chunks);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return ms
    .search(query)
    .slice(0, k)
    .map((r) => ({ ...byId.get(r.id as string)!, score: r.score }));
}

/**
 * Build a page-tagged context for one paper within a char budget.
 * If the paper is too long: keep first 2 pages, then add best-matching chunks for `focus`, in page order.
 */
export function buildPaperContext(pages: string[], budget: number, focus: string): string {
  const tagged = pages.map((p, i) => `[[Page ${i + 1}]]\n${p}`);
  const full = tagged.join("\n\n");
  if (full.length <= budget) return full;

  const head = tagged.slice(0, 2).join("\n\n").slice(0, Math.floor(budget * 0.35));
  let remaining = budget - head.length;
  const chunks = chunkPages(pages.slice(2), "p", 0, 1500, 100).map((c) => ({ ...c, page: c.page + 2 }));
  const ranked = searchChunks(chunks, focus, 200);
  const chosen: typeof chunks = [];
  const used = new Set<string>();
  for (const c of ranked) {
    if (remaining - c.text.length < 0) continue;
    chosen.push(c);
    used.add(c.id);
    remaining -= c.text.length + 20;
    if (remaining < 500) break;
  }
  // Fill with conclusion-ish tail pages if budget remains
  for (let i = chunks.length - 1; i >= 0 && remaining > 1500; i--) {
    const c = chunks[i];
    if (used.has(c.id)) continue;
    chosen.push(c);
    remaining -= c.text.length + 20;
  }
  chosen.sort((a, b) => a.page - b.page || a.id.localeCompare(b.id));
  const body: string[] = [];
  let lastPage = -1;
  for (const c of chosen) {
    if (c.page !== lastPage) {
      body.push(`[[Page ${c.page}]] (excerpt)`);
      lastPage = c.page;
    }
    body.push(c.text);
  }
  return `${head}\n\n…\n\n${body.join("\n")}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-‐‑–—_]+/g, "")
    .replace(/[“”"'‘’`]/g, "");

/** Find which page a quote appears on (fuzzy: ignores whitespace/hyphens/quotes, tries prefix). */
export function locateQuote(pages: string[], quote: string | null | undefined): number | null {
  if (!quote || quote.trim().length < 8) return null;
  const q = norm(quote.replace(/…|\.\.\./g, " "));
  const probes = [q, q.slice(0, 80), q.slice(0, 40)].filter((p) => p.length >= 12);
  const normPages = pages.map(norm);
  for (const p of probes) {
    const i = normPages.findIndex((t) => t.includes(p));
    if (i >= 0) return i + 1;
  }
  return null;
}
