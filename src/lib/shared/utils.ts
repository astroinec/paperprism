export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function formatAuthors(authors: string[], max = 3) {
  if (authors.length <= max) return authors.join(", ");
  return `${authors.slice(0, max).join(", ")} et al.`;
}

export function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const clean = s.replace(/,(?=\d{3})/g, "");
  const all = [...clean.matchAll(/-?\d+(?:\.\d+)?/g)];
  if (!all.length) return null;
  // Skip numbers glued to names like "Top-1", "GPT-4", "ResNet50"
  const attached = (m: RegExpMatchArray) => /[A-Za-z]/.test(clean.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0));
  const m = all.find((x) => !attached(x));
  if (!m) return null;
  let n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  const tail = clean.slice((m.index ?? 0) + m[0].length);
  const sm = tail.match(/^\s?(billion|million|thousand|[KMB])(?![a-zA-Z])/i);
  if (sm) {
    const u = sm[1].toLowerCase();
    if (u === "b" || u === "billion") n *= 1e9;
    else if (u === "m" || u === "million") n *= 1e6;
    else n *= 1e3;
  } else if (/^\s?亿/.test(tail)) n *= 1e8;
  else if (/^\s?万/.test(tail)) n *= 1e4;
  return n;
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
