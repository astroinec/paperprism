import { z } from "zod";
import { generateJson } from "../llm/json";
import { generateLLM, resolveTarget } from "../llm";
import { getCells, getDimensions, getProject, getProjectPapers, setDimensionSummary } from "../repo/projects";
import type { DimensionType } from "@/lib/shared/types";

const SuggestSchema = z.object({
  dimensions: z.array(
    z.object({
      name: z.string(),
      description: z.string().default(""),
      type: z.enum(["text", "number", "rating", "tags"]).catch("text"),
    }),
  ),
});

export async function suggestDimensions(projectId: string, lang: "zh" | "en") {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  const papers = getProjectPapers(projectId);
  const target = resolveTarget(null, "suggest");
  const list = papers
    .map((p, i) => `P${i + 1}: ${p.title}${p.year ? ` (${p.year})` : ""}\nAbstract: ${(p.abstract ?? "").slice(0, 1500)}`)
    .join("\n\n");
  const res = await generateJson(
    target,
    {
      task: "suggest",
      system: `You design comparison matrices for literature reviews. Propose 6-10 dimensions that best differentiate the given papers.
Each: name (short), description (guidance for extraction), type: "text" | "number" (a single comparable metric) | "rating" (1-5 judgement) | "tags".
Prefer at least one "number" dimension for a shared benchmark metric if the papers report one, and one or two "rating" dimensions.
Write names/descriptions in ${lang === "zh" ? "Simplified Chinese" : "English"}. Output ONLY JSON: {"dimensions":[{"name":"","description":"","type":"text"}]}`,
      messages: [{ role: "user", content: `${project.question ? `Comparison goal: ${project.question}\n\n` : ""}${list}` }],
      meta: { lang },
    },
    SuggestSchema,
  );
  return res.dimensions.slice(0, 12) as { name: string; description: string; type: DimensionType }[];
}

export async function summarizeDimensions(projectId: string, lang: "zh" | "en") {
  const papers = getProjectPapers(projectId);
  const dims = getDimensions(projectId);
  const cells = getCells(projectId);
  const target = resolveTarget(null, "extract");
  const results: { dimensionId: string; summary: string }[] = [];
  for (const d of dims) {
    const values = papers
      .map((p, i) => {
        const c = cells.find((x) => x.paperId === p.id && x.dimensionId === d.id && x.status === "done");
        return c ? { label: `P${i + 1}`, value: c.value } : null;
      })
      .filter(Boolean) as { label: string; value: string }[];
    if (values.length < 2) continue;
    const text = await generateLLM(target, {
      task: "summary",
      system: `Write ONE sentence (max 60 ${lang === "zh" ? "Chinese characters" : "words"}) that contrasts the papers on the given dimension, naming papers as P1, P2... Output only the sentence in ${lang === "zh" ? "Simplified Chinese" : "English"}.`,
      messages: [{ role: "user", content: `Dimension: ${d.name}\n${values.map((v) => `${v.label}: ${v.value}`).join("\n")}` }],
      maxTokens: 300,
      meta: { lang, dimension: d.name, values },
    });
    const summary = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    setDimensionSummary(d.id, summary);
    results.push({ dimensionId: d.id, summary });
  }
  return results;
}
