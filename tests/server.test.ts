import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { bibEscape, citeKey, toBibtex } from "@/lib/server/export/bibtex";
import { extractJson } from "@/lib/server/llm/json";
import { createThinkFilter } from "@/lib/server/llm/think";
import { chunkPages, locateQuote, searchChunks, tokenize } from "@/lib/server/retrieval";
import { decrypt, encrypt, mask } from "@/lib/server/crypto";
import { parseArxivAtom, parseArxivId } from "@/lib/server/sources/arxiv";
import type { Paper } from "@/lib/shared/types";

const paper = (p: Partial<Paper>): Paper => ({
  id: "x",
  title: "Untitled",
  authors: [],
  year: null,
  venue: null,
  doi: null,
  arxivId: null,
  abstract: null,
  url: null,
  source: "upload",
  hasFile: false,
  numPages: 0,
  status: "ready",
  error: null,
  tags: [],
  citationCount: null,
  createdAt: 0,
  ...p,
});

describe("bibtex", () => {
  it("escapes LaTeX specials", () => {
    expect(bibEscape("R&D 50% $x_1$ {a}")).toBe("R\\&D 50\\% \\$x\\_1\\$ \\{a\\}");
  });

  it("builds stable, de-duplicated cite keys", () => {
    const used = new Set<string>();
    const p = { authors: ["Ashish Vaswani"], year: 2017, title: "Attention Is All You Need" };
    expect(citeKey(p, used)).toBe("vaswani2017attention");
    expect(citeKey(p, used)).toBe("vaswani2017attentionb");
    expect(citeKey({ authors: ["Vaswani, Ashish"], year: 2017, title: "Attention" }, new Set())).toBe("vaswani2017attention");
    expect(citeKey({ authors: [], year: null, title: "A B" }, new Set())).toBe("anonpaper");
  });

  it("emits arXiv entries as @misc with eprint", () => {
    const bib = toBibtex([paper({ title: "Attention Is All You Need", authors: ["Ashish Vaswani", "Noam Shazeer"], year: 2017, arxivId: "1706.03762", venue: "arXiv" })]);
    expect(bib).toMatch(/^@misc\{vaswani2017attention,/);
    expect(bib).toContain("author = {Ashish Vaswani and Noam Shazeer}");
    expect(bib).toContain("eprint = {1706.03762}");
    expect(bib).toContain("howpublished = {arXiv preprint arXiv:1706.03762}");
  });

  it("emits journal papers as @article", () => {
    const bib = toBibtex([paper({ title: "Deep Residual Learning", authors: ["Kaiming He"], year: 2016, venue: "CVPR", doi: "10.1109/CVPR.2016.90" })]);
    expect(bib).toMatch(/^@article\{/);
    expect(bib).toContain("journal = {CVPR}");
    expect(bib).toContain("url = {https://doi.org/10.1109/CVPR.2016.90}");
  });
});

describe("extractJson", () => {
  it("parses fenced JSON with surrounding prose", () => {
    expect(extractJson('Sure! Here you go:\n```json\n{"a": 1}\n```\nHope it helps')).toEqual({ a: 1 });
  });
  it("strips <think> blocks and trailing commas", () => {
    expect(extractJson('<think>{"no": true}</think> {"cells": [{"v": 1},],}')).toEqual({ cells: [{ v: 1 }] });
  });
  it("handles braces inside strings", () => {
    expect(extractJson('x {"q": "a } b { c", "n": [1,2]} y')).toEqual({ q: "a } b { c", n: [1, 2] });
  });
  it("parses top-level arrays", () => {
    expect(extractJson("result: [1, 2, 3]")).toEqual([1, 2, 3]);
  });
  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("think filter", () => {
  it("removes think blocks split across chunks", () => {
    const f = createThinkFilter();
    const out = ["Hel", "lo <thi", "nk>secret", " stuff</th", "ink> wor", "ld"].map(f).join("");
    expect(out).toBe("Hello  world");
  });
  it("passes through text with a lone '<'", () => {
    const f = createThinkFilter();
    expect(["a < b", " and c"].map(f).join("")).toBe("a < b and c");
  });
});

describe("retrieval", () => {
  it("tokenizes Latin words and CJK bigrams", () => {
    expect(tokenize("The Transformer uses 注意力机制")).toEqual(["transformer", "uses", "注意", "意力", "力机", "机制"]);
  });

  it("chunks long pages with overlap and page numbers", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkPages(["", long], "p1", 1, 400, 50);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.page === 2 && c.text.length <= 400)).toBe(true);
  });

  it("ranks relevant chunks first (incl. Chinese queries)", () => {
    const chunks = [
      ...chunkPages(["We evaluate on ImageNet and report top-1 accuracy."], "a", 1),
      ...chunkPages(["本文提出一种新的注意力机制，显著降低计算成本。"], "b", 2),
      ...chunkPages(["Related work covers convolutional networks."], "c", 3),
    ];
    expect(searchChunks(chunks, "ImageNet accuracy")[0].paperId).toBe("a");
    expect(searchChunks(chunks, "注意力机制的计算成本")[0].paperId).toBe("b");
  });

  it("locates quotes across hyphenation and whitespace", () => {
    const pages = ["Introduction text.", "We propose a novel atten-\ntion mechanism that  scales linearly with length."];
    expect(locateQuote(pages, "a novel attention mechanism that scales linearly")).toBe(2);
    expect(locateQuote(pages, "something that is absent from the paper")).toBeNull();
    expect(locateQuote(pages, "short")).toBeNull();
  });
});

describe("crypto", () => {
  const key = crypto.randomBytes(32);
  it("round-trips with AES-256-GCM", () => {
    const enc = encrypt("sk-test-1234567890", key);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("sk-test");
    expect(decrypt(enc, key)).toBe("sk-test-1234567890");
  });
  it("uses a random IV per encryption", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });
  it("rejects tampered payloads and wrong keys", () => {
    const enc = encrypt("secret", key);
    expect(() => decrypt(enc, crypto.randomBytes(32))).toThrow();
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"), key)).toThrow();
  });
  it("masks keys", () => {
    expect(mask("")).toBe("");
    expect(mask("short")).toBe("••••");
    expect(mask("sk-abcdefghijkl1234")).toBe("sk-••••1234");
  });
});

describe("arXiv", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <published>2017-06-12T17:57:34Z</published>
    <title>Attention Is All
      You Need</title>
    <summary>  The dominant sequence transduction models...  </summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <arxiv:doi>10.48550/arXiv.1706.03762</arxiv:doi>
    <link href="http://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
    <arxiv:primary_category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2010.11929v2</id>
    <published>2020-10-22T17:55:59Z</published>
    <title>An Image is Worth 16x16 Words</title>
    <summary>While the Transformer architecture...</summary>
    <author><name>Alexey Dosovitskiy</name></author>
  </entry>
</feed>`;

  it("parses Atom feeds with single/multiple authors and links", () => {
    const [a, b] = parseArxivAtom(xml);
    expect(a.title).toBe("Attention Is All You Need");
    expect(a.arxivId).toBe("1706.03762v7");
    expect(a.authors).toEqual(["Ashish Vaswani", "Noam Shazeer"]);
    expect(a.year).toBe(2017);
    expect(a.doi).toBe("10.48550/arXiv.1706.03762");
    expect(a.pdfUrl).toBe("https://arxiv.org/pdf/1706.03762v7");
    expect(a.venue).toBe("arXiv · cs.CL");
    expect(a.abstract).toBe("The dominant sequence transduction models...");
    expect(b.authors).toEqual(["Alexey Dosovitskiy"]);
    expect(b.pdfUrl).toBe("https://arxiv.org/pdf/2010.11929v2");
  });

  it("returns [] for empty feeds", () => {
    expect(parseArxivAtom('<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toEqual([]);
  });

  it.each([
    ["https://arxiv.org/abs/1706.03762", "1706.03762"],
    ["https://arxiv.org/pdf/2010.11929v2", "2010.11929v2"],
    ["arXiv:2303.08774", "2303.08774"],
    ["2401.00001", "2401.00001"],
    ["10.1109/CVPR.2016.90", null],
  ])("parseArxivId(%s)", (input, expected) => {
    expect(parseArxivId(input)).toBe(expected);
  });
});
