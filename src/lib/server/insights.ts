import { getPages } from "./repo/papers";
import { getCells, getDimensions, getProjectPapers } from "./repo/projects";
import { tokenize } from "./retrieval";

export interface Insights {
  papers: { id: string; label: string; title: string; year: number | null }[];
  bars: { dimensionId: string; name: string; values: (number | null)[] }[];
  radar: { indicators: { dimensionId: string; name: string }[]; series: { label: string; values: (number | null)[] }[] } | null;
  timeline: { label: string; title: string; year: number | null; note: string | null }[];
  similarity: number[][];
}

function tfidfVectors(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const N = docs.length;
  return docs.map((d) => {
    const tf = new Map<string, number>();
    d.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    const v = new Map<string, number>();
    tf.forEach((c, t) => v.set(t, (1 + Math.log(c)) * Math.log(1 + N / (df.get(t) ?? 1))));
    return v;
  });
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  a.forEach((x, k) => {
    na += x * x;
    const y = b.get(k);
    if (y) dot += x * y;
  });
  b.forEach((y) => (nb += y * y));
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function computeInsights(projectId: string): Insights {
  const papers = getProjectPapers(projectId);
  const dims = getDimensions(projectId);
  const cells = getCells(projectId);
  const get = (pid: string, did: string) => cells.find((c) => c.paperId === pid && c.dimensionId === did && c.status === "done");

  const bars = dims
    .filter((d) => d.type === "number")
    .map((d) => ({ dimensionId: d.id, name: d.name, values: papers.map((p) => get(p.id, d.id)?.numeric ?? null) }))
    .filter((b) => b.values.some((v) => v != null));

  const ratingDims = dims.filter((d) => d.type === "rating" && papers.some((p) => get(p.id, d.id)?.numeric != null));
  const radar =
    ratingDims.length >= 3
      ? {
          indicators: ratingDims.map((d) => ({ dimensionId: d.id, name: d.name })),
          series: papers.map((p, i) => ({ label: `P${i + 1}`, values: ratingDims.map((d) => get(p.id, d.id)?.numeric ?? null) })),
        }
      : null;

  const methodDim = dims.find((d) => /method|方法|architecture|架构|approach/i.test(d.name)) ?? dims[0];
  const timeline = papers
    .map((p, i) => ({
      label: `P${i + 1}`,
      title: p.title,
      year: p.year,
      note: methodDim ? get(p.id, methodDim.id)?.value ?? null : null,
    }))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  const docs = papers.map((p) => {
    const pages = getPages(p.id);
    const text = pages.length ? pages.join(" ").slice(0, 200_000) : `${p.title} ${p.abstract ?? ""}`;
    return tokenize(text);
  });
  const vecs = tfidfVectors(docs);
  const similarity = vecs.map((a, i) => vecs.map((b, j) => (i === j ? 1 : Math.round(cosine(a, b) * 100) / 100)));

  return {
    papers: papers.map((p, i) => ({ id: p.id, label: `P${i + 1}`, title: p.title, year: p.year })),
    bars,
    radar,
    timeline,
    similarity,
  };
}
