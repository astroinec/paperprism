import { describe, expect, it } from "vitest";
import { invalidCitations, linkifyCitations, parseCitations } from "@/lib/shared/citations";
import { formatAuthors, parseNumber, truncate } from "@/lib/shared/utils";

describe("citations", () => {
  it("parses single, paged and grouped citations", () => {
    const c = parseCitations("A [P1] and B [P2, p.5] and C [P1, p.3; P3，p12].");
    expect(c.map((x) => [x.paperIndex, x.page])).toEqual([
      [1, null],
      [2, 5],
      [1, 3],
      [3, 12],
    ]);
  });

  it("linkifies citations into anchor links", () => {
    expect(linkifyCitations("see [P2, p.5]")).toBe("see [P2 · p.5](#cite-2-5)");
    expect(linkifyCitations("[P1; P2]")).toBe("[P1](#cite-1-0) [P2](#cite-2-0)");
  });

  it("ignores ordinary markdown brackets", () => {
    expect(parseCitations("[link](http://x) [Paper 1] [p1]")).toHaveLength(0);
  });

  it("detects out-of-range paper indexes", () => {
    expect(invalidCitations("[P1] [P3, p.2] [P0]", 2)).toEqual(["[P3, p.2]", "[P0]"]);
  });
});

describe("parseNumber", () => {
  it.each([
    ["28.4 BLEU", 28.4],
    ["Top-1 81.2%", 81.2],
    ["GPT-4 scores 86.4", 86.4],
    ["175B", 175e9],
    ["65M params", 65e6],
    ["1.3 billion", 1.3e9],
    ["1,234 images", 1234],
    ["1,200M tokens", 1.2e9],
    ["3 亿参数", 3e8],
    ["12 万条", 12e4],
    ["12 Mbps", 12],
    ["-0.5 dB", -0.5],
  ])("%s → %d", (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected);
  });

  it("returns null when no number", () => {
    expect(parseNumber("not reported")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });

  it("returns null when every number is part of a name", () => {
    expect(parseNumber("ResNet-50")).toBeNull();
    expect(parseNumber("We use ImageNet-21K")).toBeNull();
  });
});

describe("utils", () => {
  it("formats authors with et al.", () => {
    expect(formatAuthors(["A", "B"])).toBe("A, B");
    expect(formatAuthors(["A", "B", "C", "D"])).toBe("A, B, C et al.");
  });
  it("truncates with ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
