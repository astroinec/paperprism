import { z } from "zod";
import { generateJson } from "../llm/json";
import { resolveTarget } from "../llm";
import { buildPaperContext, locateQuote } from "../retrieval";
import { getPages, getPaper } from "../repo/papers";
import { getDimensions, getProject, touchProject, upsertCell } from "../repo/projects";
import { getSettings } from "../repo/settings";
import { parseNumber } from "@/lib/shared/utils";
import type { Cell, Dimension } from "@/lib/shared/types";

const CellSchema = z.object({
  dimension_id: z.string(),
  value: z.union([z.string(), z.number()]).transform(String),
  numeric: z.union([z.number(), z.string(), z.null()]).optional(),
  quote: z.string().nullable().optional(),
  page: z.union([z.number(), z.string(), z.null()]).optional(),
  confidence: z.enum(["high", "medium", "low"]).catch("medium").optional(),
  source: z.enum(["stated", "inferred", "not_found"]).catch("inferred").optional(),
});
const ResultSchema = z.object({ cells: z.array(CellSchema) });

const TYPE_HINT: Record<string, string> = {
  text: "concise text (1-3 sentences)",
  number: "a single key number with unit/context in `value`, and the bare number in `numeric`",
  rating: "an integer score 1-5 in `numeric`, and `value` like '4/5 - short reason'",
  tags: "short comma-separated tags",
};

function systemPrompt(lang: "zh" | "en") {
  return `You are a meticulous research assistant that extracts structured, evidence-backed facts from academic papers for a comparison matrix.
Rules:
- Use ONLY the provided paper text. Never invent facts.
- For every dimension, give a "quote": a short VERBATIM excerpt (10-60 words) copied exactly from the text that supports the value, and the "page" number from the nearest preceding [[Page N]] marker.
- "source": "stated" if the paper explicitly says it, "inferred" if you reasoned it from the text, "not_found" if the paper does not cover it (then value should say so briefly, quote="" and page=null).
- "confidence": high | medium | low.
- Write "value" in ${lang === "zh" ? "Simplified Chinese (keep technical terms, model names and numbers in original form)" : "English"}.
- Output ONLY a JSON object: {"cells":[{"dimension_id":"...","value":"...","numeric":null,"quote":"...","page":1,"confidence":"high","source":"stated"}]}`;
}

function userPrompt(dims: Dimension[], question: string, title: string, context: string) {
  const dimList = dims
    .map((d) => `- dimension_id: "${d.id}" | name: ${d.name}${d.description ? ` | guidance: ${d.description}` : ""} | expected: ${TYPE_HINT[d.type]}`)
    .join("\n");
  return `${question ? `Comparison goal: ${question}\n\n` : ""}Dimensions to extract:
${dimList}

Paper title: ${title}

<paper>
${context}
</paper>

Return the JSON now, one entry per dimension_id above.`;
}

export async function extractForPaper(opts: { projectId: string; paperId: string; dimensionIds?: string[]; lang: "zh" | "en" }): Promise<Cell[]> {
  const project = getProject(opts.projectId);
  const paper = getPaper(opts.paperId);
  if (!project || !paper) throw new Error("Project or paper not found");
  let dims = getDimensions(opts.projectId);
  if (opts.dimensionIds?.length) dims = dims.filter((d) => opts.dimensionIds!.includes(d.id));
  if (!dims.length) return [];

  const target = resolveTarget(null, "extract");
  const settings = getSettings();
  const pages = getPages(paper.id);
  const fallbackText = [paper.title, paper.abstract].filter(Boolean).join("\n\n");
  const usablePages = pages.length ? pages : [fallbackText];
  const focus = dims.map((d) => `${d.name} ${d.description}`).join(" ");
  const context = buildPaperContext(usablePages, settings.contextChars, focus);

  const batches: Dimension[][] = [];
  for (let i = 0; i < dims.length; i += 12) batches.push(dims.slice(i, i + 12));

  const out: Cell[] = [];
  for (const batch of batches) {
    try {
      const result = await generateJson(
        target,
        {
          task: "extract",
          system: systemPrompt(opts.lang),
          messages: [{ role: "user", content: userPrompt(batch, project.question, paper.title, context) }],
          meta: { dimensions: batch, pages: usablePages, lang: opts.lang },
        },
        ResultSchema,
      );
      for (const d of batch) {
        const r = result.cells.find((c) => c.dimension_id === d.id) ?? result.cells.find((c) => c.dimension_id === d.name);
        const cell: Omit<Cell, "updatedAt"> = r
          ? normalizeCell(r, d, usablePages, opts, target.modelId)
          : {
              projectId: opts.projectId,
              paperId: opts.paperId,
              dimensionId: d.id,
              value: "",
              numeric: null,
              quote: null,
              page: null,
              confidence: null,
              source: null,
              verified: false,
              status: "error",
              error: "模型未返回该维度",
              edited: false,
              model: target.modelId,
            };
        upsertCell(cell);
        out.push({ ...cell, updatedAt: Date.now() });
      }
    } catch (e) {
      for (const d of batch) {
        const cell: Omit<Cell, "updatedAt"> = {
          projectId: opts.projectId,
          paperId: opts.paperId,
          dimensionId: d.id,
          value: "",
          numeric: null,
          quote: null,
          page: null,
          confidence: null,
          source: null,
          verified: false,
          status: "error",
          error: (e as Error).message.slice(0, 300),
          edited: false,
          model: target.modelId,
        };
        upsertCell(cell);
        out.push({ ...cell, updatedAt: Date.now() });
      }
    }
  }
  touchProject(opts.projectId);
  return out;
}

function normalizeCell(
  r: z.infer<typeof CellSchema>,
  d: Dimension,
  pages: string[],
  opts: { projectId: string; paperId: string },
  model: string,
): Omit<Cell, "updatedAt"> {
  const quote = r.quote?.trim() || null;
  const located = locateQuote(pages, quote);
  let page = r.page == null || r.page === "" ? null : Number(r.page);
  if (page != null && !Number.isFinite(page)) page = null;
  if (located) page = located;
  let numeric: number | null = r.numeric == null || r.numeric === "" ? null : Number(r.numeric);
  if (numeric != null && !Number.isFinite(numeric)) numeric = parseNumber(String(r.numeric));
  if (numeric == null && (d.type === "number" || d.type === "rating")) numeric = parseNumber(r.value);
  if (d.type === "rating" && numeric != null) numeric = Math.max(1, Math.min(5, Math.round(numeric)));
  return {
    projectId: opts.projectId,
    paperId: opts.paperId,
    dimensionId: d.id,
    value: r.value.trim(),
    numeric: r.source === "not_found" ? null : numeric,
    quote,
    page,
    confidence: r.confidence ?? "medium",
    source: r.source ?? "inferred",
    verified: !!located,
    status: "done",
    error: null,
    edited: false,
    model,
  };
}
