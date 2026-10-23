export interface Citation {
  raw: string;
  paperIndex: number;
  page: number | null;
  start: number;
  end: number;
}

/** Matches [P1], [P2, p.5], [P3，p5], [P1, p. 12] and multi like [P1, p.3; P2, p.4] */
const GROUP_RE = /\[(P\d+(?:\s*[,，]\s*p\.?\s*\d+)?(?:\s*[;；]\s*P\d+(?:\s*[,，]\s*p\.?\s*\d+)?)*)\]/g;
const ITEM_RE = /P(\d+)(?:\s*[,，]\s*p\.?\s*(\d+))?/g;

export function parseCitations(text: string): Citation[] {
  const out: Citation[] = [];
  for (const m of text.matchAll(GROUP_RE)) {
    const start = m.index ?? 0;
    for (const it of m[1].matchAll(ITEM_RE)) {
      out.push({
        raw: m[0],
        paperIndex: Number(it[1]),
        page: it[2] ? Number(it[2]) : null,
        start,
        end: start + m[0].length,
      });
    }
  }
  return out;
}

/** Convert citations into markdown links: cite:P{i}:{page} so the renderer can intercept */
export function linkifyCitations(text: string): string {
  return text.replace(GROUP_RE, (_full, inner: string) => {
    const parts: string[] = [];
    for (const it of inner.matchAll(ITEM_RE)) {
      const label = it[2] ? `P${it[1]} · p.${it[2]}` : `P${it[1]}`;
      parts.push(`[${label}](#cite-${it[1]}-${it[2] ?? 0})`);
    }
    return parts.join(" ");
  });
}

export function invalidCitations(text: string, paperCount: number): string[] {
  const bad = new Set<string>();
  for (const c of parseCitations(text)) {
    if (c.paperIndex < 1 || c.paperIndex > paperCount) bad.add(c.raw);
  }
  return [...bad];
}
