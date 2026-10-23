import type { LLMRequest, ResolvedTarget, Usage } from "./types";
import { parseNumber } from "@/lib/shared/utils";

/**
 * Offline demo provider. Produces deterministic, plausible outputs using the
 * structured `meta` hints that each agent attaches to its request.
 */

type Lang = "zh" | "en";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);
}

function keywords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter((w) => w.length > 3);
}

const DIM_HINTS: Record<string, string[]> = {
  problem: ["problem", "challenge", "address", "aim", "goal", "motivat"],
  method: ["propose", "method", "approach", "framework", "model", "architecture", "introduce"],
  data: ["dataset", "data", "corpus", "benchmark", "sample"],
  result: ["achieve", "outperform", "result", "accuracy", "improve", "state-of-the-art"],
  contribution: ["contribution", "novel", "first", "propose"],
  limitation: ["limitation", "however", "future work", "fail", "drawback"],
  metric: ["metric", "accuracy", "f1", "bleu", "score", "precision"],
  train: ["train", "loss", "optimiz", "pretrain", "fine-tun"],
};

function pickSentence(pages: string[], dimText: string, seed: number): { s: string; page: number } | null {
  const kws = new Set(keywords(dimText));
  for (const [k, list] of Object.entries(DIM_HINTS)) {
    if ([...kws].some((w) => w.includes(k) || k.includes(w))) list.forEach((x) => kws.add(x));
  }
  let best: { s: string; page: number; score: number } | null = null;
  pages.forEach((p, i) => {
    for (const s of sentences(p)) {
      const low = s.toLowerCase();
      let score = 0;
      kws.forEach((k) => low.includes(k) && (score += 1));
      score += ((hash(s) + seed) % 100) / 1000;
      if (!best || score > best.score) best = { s, page: i + 1, score };
    }
  });
  return best;
}

function genExtract(meta: Record<string, unknown>): string {
  const dims = (meta.dimensions as { id: string; name: string; description: string; type: string }[]) ?? [];
  const pages = (meta.pages as string[]) ?? [];
  const cells = dims.map((d, i) => {
    const hit = pickSentence(pages, `${d.name} ${d.description}`, i * 7);
    if (!hit) {
      return { dimension_id: d.id, value: "Not mentioned", numeric: null, quote: "", page: null, confidence: "low", source: "not_found" };
    }
    if (d.type === "rating") {
      const score = 3 + (hash(hit.s + d.id) % 3);
      return { dimension_id: d.id, value: `${score}/5`, numeric: score, quote: hit.s, page: hit.page, confidence: "medium", source: "inferred" };
    }
    if (d.type === "number") {
      const parsed = parseNumber(hit.s);
      const n = parsed ?? 50 + (hash(hit.s) % 40);
      const num = parsed != null;
      return { dimension_id: d.id, value: String(n), numeric: n, quote: hit.s, page: hit.page, confidence: num ? "medium" : "low", source: num ? "stated" : "inferred" };
    }
    const value = hit.s.length > 160 ? hit.s.slice(0, 157) + "…" : hit.s;
    return { dimension_id: d.id, value, numeric: null, quote: hit.s, page: hit.page, confidence: "medium", source: "stated" };
  });
  return JSON.stringify({ cells }, null, 2);
}

function genSuggest(lang: Lang): string {
  const zh = [
    ["研究问题", "论文试图解决的核心问题", "text"],
    ["方法框架", "所提方法的核心思路与关键模块", "text"],
    ["数据集", "实验使用的数据集", "text"],
    ["主要指标结果", "主基准上的核心数值", "number"],
    ["创新性", "1-5 分", "rating"],
    ["局限性", "方法或实验的不足", "text"],
  ];
  const en = [
    ["Research Problem", "Core problem addressed", "text"],
    ["Method", "Key idea and modules", "text"],
    ["Datasets", "Datasets used in experiments", "text"],
    ["Headline Result", "Main metric value", "number"],
    ["Novelty", "1-5", "rating"],
    ["Limitations", "Weaknesses of method or evaluation", "text"],
  ];
  return JSON.stringify({ dimensions: (lang === "zh" ? zh : en).map(([name, description, type]) => ({ name, description, type })) });
}

function genSummary(meta: Record<string, unknown>): string {
  const lang = (meta.lang as Lang) ?? "zh";
  const vals = (meta.values as { label: string; value: string }[]) ?? [];
  if (!vals.length) return lang === "zh" ? "暂无可比较内容。" : "Nothing to compare yet.";
  const labels = vals.map((v) => v.label).join(lang === "zh" ? "、" : ", ");
  return lang === "zh"
    ? `${labels} 在「${meta.dimension}」上各有侧重，${vals[0].label} 更突出，其余论文提供了互补视角。`
    : `${labels} differ on "${meta.dimension}"; ${vals[0].label} stands out while others offer complementary angles.`;
}

function genOutline(meta: Record<string, unknown>): string {
  const lang = (meta.lang as Lang) ?? "zh";
  const style = meta.style as string;
  const zh = style === "brief"
    ? [["核心结论", "一句话总结各论文差异"], ["要点对比", "按维度列出关键差异"], ["建议", "阅读与选型建议"]]
    : style === "related_work"
      ? [["Related Work", "以学术段落形式综述并比较各论文"]]
      : [["概述", "介绍对比范围与研究背景"], ["方法对比", "比较各论文方法的异同"], ["实验与结果", "比较数据集、指标与结果"], ["优劣分析", "分析各自优势与不足"], ["研究空白与未来方向", "总结尚未解决的问题"], ["结论", "总结全文"]];
  const en = style === "brief"
    ? [["Key Takeaways", "One-line differences"], ["Point-by-point", "Key differences by dimension"], ["Recommendations", "What to read / use"]]
    : style === "related_work"
      ? [["Related Work", "Academic paragraph comparing the papers"]]
      : [["Overview", "Scope and background"], ["Methods", "Compare approaches"], ["Experiments & Results", "Datasets, metrics, results"], ["Strengths & Weaknesses", "Trade-offs"], ["Gaps & Future Work", "Open problems"], ["Conclusion", "Wrap-up"]];
  return JSON.stringify({ sections: (lang === "zh" ? zh : en).map(([title, goal]) => ({ title, goal })) });
}

function genSection(meta: Record<string, unknown>): string {
  const lang = (meta.lang as Lang) ?? "zh";
  const papers = (meta.papers as { label: string; title: string }[]) ?? [];
  const cells = (meta.cells as { label: string; dim: string; value: string; page: number | null }[]) ?? [];
  const sec = meta.section as { title: string; goal: string };
  const paras: string[] = [];
  const pick = cells.filter((_, i) => (i + hash(sec.title)) % 3 === 0).slice(0, 4);
  if (lang === "zh") {
    paras.push(`本节围绕「${sec.title}」展开，${sec.goal}。共涉及 ${papers.length} 篇论文。`);
    for (const c of pick) paras.push(`- **${c.label}** 在「${c.dim}」方面：${c.value} [${c.label}${c.page ? `, p.${c.page}` : ""}]`);
    if (papers.length > 1) paras.push(`\n总体而言，${papers[0].label} 与 ${papers[papers.length - 1].label} 的思路形成了互补，值得结合阅读 [${papers[0].label}]。`);
  } else {
    paras.push(`This section covers **${sec.title}** — ${sec.goal}. ${papers.length} papers are considered.`);
    for (const c of pick) paras.push(`- **${c.label}** on *${c.dim}*: ${c.value} [${c.label}${c.page ? `, p.${c.page}` : ""}]`);
    if (papers.length > 1) paras.push(`\nOverall, ${papers[0].label} and ${papers[papers.length - 1].label} are complementary [${papers[0].label}].`);
  }
  return paras.join("\n");
}

function genChat(meta: Record<string, unknown>): string {
  const lang = (meta.lang as Lang) ?? "zh";
  const sources = (meta.sources as { label: string; page: number; text: string }[]) ?? [];
  if (!sources.length) return lang === "zh" ? "在当前论文中没有找到相关内容。" : "I couldn't find relevant content in these papers.";
  const lines = sources.slice(0, 3).map((s) => {
    const sent = sentences(s.text)[0] ?? s.text.slice(0, 160);
    return `- ${sent} [${s.label}, p.${s.page}]`;
  });
  return lang === "zh"
    ? `（离线演示模型）根据检索到的原文片段：\n\n${lines.join("\n")}\n\n配置真实模型后可获得完整的推理式回答。`
    : `(Offline demo model) Based on retrieved passages:\n\n${lines.join("\n")}\n\nConfigure a real model for full answers.`;
}

function generateMock(req: LLMRequest): string {
  const meta = req.meta ?? {};
  const lang = (meta.lang as Lang) ?? "zh";
  switch (req.task) {
    case "extract":
      return genExtract(meta);
    case "suggest":
      return genSuggest(lang);
    case "summary":
      return genSummary(meta);
    case "outline":
      return genOutline(meta);
    case "section":
      return genSection(meta);
    case "chat":
      return genChat(meta);
    default:
      return "pong";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* mockStream(_t: ResolvedTarget, req: LLMRequest): AsyncGenerator<string, Usage | undefined> {
  const text = generateMock(req);
  const streaming = ["section", "chat", "summary"].includes(req.task);
  if (!streaming) {
    await sleep(400 + (hash(text) % 600));
    yield text;
  } else {
    for (let i = 0; i < text.length; i += 6) {
      if (req.signal?.aborted) break;
      yield text.slice(i, i + 6);
      await sleep(12);
    }
  }
  const inChars = (req.system?.length ?? 0) + req.messages.reduce((a, m) => a + m.content.length, 0);
  return { inputTokens: Math.ceil(inChars / 4), outputTokens: Math.ceil(text.length / 4) };
}
