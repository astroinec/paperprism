import { z } from "zod";
import { generateJson } from "../llm/json";
import { resolveTarget, streamLLM } from "../llm";
import { createThinkFilter } from "../llm/think";
import { getCells, getDimensions, getProject, getProjectPapers } from "../repo/projects";
import { createReport, updateReport } from "../repo/content";
import { matrixMarkdown } from "../export/markdown";
import { invalidCitations } from "@/lib/shared/citations";
import type { OutlineSection, ReportEvent, ReportStyle } from "@/lib/shared/types";

const OutlineSchema = z.object({
  sections: z.array(z.object({ title: z.string(), goal: z.string().default("") })).min(1),
});

const STYLE_DESC: Record<ReportStyle, string> = {
  academic: "a structured academic comparative review (5-7 sections: overview, methods, experiments/results, strengths & weaknesses, research gaps & future directions, conclusion)",
  brief: "a concise executive brief (2-4 short sections with bullet points)",
  related_work: "a single 'Related Work' section written as flowing academic paragraphs suitable for a paper (1-2 sections)",
};

export async function* generateReport(opts: {
  projectId: string;
  style: ReportStyle;
  lang: "zh" | "en";
  signal?: AbortSignal;
}): AsyncGenerator<ReportEvent> {
  const project = getProject(opts.projectId);
  if (!project) throw new Error("Project not found");
  const papers = getProjectPapers(opts.projectId);
  const dims = getDimensions(opts.projectId);
  const cells = getCells(opts.projectId);
  const target = resolveTarget(null, "report");
  const langName = opts.lang === "zh" ? "Simplified Chinese" : "English";

  const paperList = papers
    .map(
      (p, i) =>
        `P${i + 1}: ${p.title}${p.year ? ` (${p.year})` : ""}${p.authors.length ? ` — ${p.authors.slice(0, 3).join(", ")}` : ""}\nAbstract: ${(p.abstract ?? "").slice(0, 1200)}`,
    )
    .join("\n\n");
  const matrix = matrixMarkdown(papers, dims, cells, { withPages: true });
  const insights = dims.filter((d) => d.summary).map((d) => `- ${d.name}: ${d.summary}`).join("\n");
  const material = `${project.question ? `Comparison goal: ${project.question}\n\n` : ""}Papers:\n${paperList}\n\nComparison matrix (values with source pages):\n${matrix}${insights ? `\n\nDimension insights:\n${insights}` : ""}`;

  const reportId = createReport({ projectId: opts.projectId, style: opts.style, language: opts.lang, model: target.modelId });

  yield { type: "step", step: "plan" };
  const outline = await generateJson(
    target,
    {
      task: "outline",
      system: `You are an expert academic writer planning ${STYLE_DESC[opts.style]}. Produce an outline. Section titles in ${langName}. Output ONLY JSON: {"sections":[{"title":"","goal":"what this section must cover"}]}`,
      messages: [{ role: "user", content: material }],
      signal: opts.signal,
      meta: { lang: opts.lang, style: opts.style },
    },
    OutlineSchema,
  );
  const sections: OutlineSection[] = outline.sections.slice(0, 8);
  updateReport(reportId, { outline: sections });
  yield { type: "outline", sections };

  let content = "";
  const cellMeta = cells
    .filter((c) => c.status === "done")
    .map((c) => {
      const pi = papers.findIndex((p) => p.id === c.paperId);
      const d = dims.find((x) => x.id === c.dimensionId);
      return { label: `P${pi + 1}`, dim: d?.name ?? "", value: c.value, page: c.page };
    });

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    yield { type: "step", step: "draft", section: i };
    const header = `${i === 0 ? "" : "\n\n"}## ${s.title}\n\n`;
    content += header;
    yield { type: "delta", section: i, text: header };
    const filter = createThinkFilter();
    const stream = streamLLM(target, {
      task: "section",
      system: `You are writing ${STYLE_DESC[opts.style]} in ${langName}, in Markdown.
Write ONLY the body of the requested section (do NOT repeat the section heading; you may use ### sub-headings, lists, and tables).
Ground every claim in the provided material. Cite papers inline as [P1] or with page [P1, p.5] using the page numbers from the matrix. Use only P1..P${papers.length}.
Be specific and comparative: highlight similarities, differences, trade-offs. Avoid filler.`,
      messages: [
        {
          role: "user",
          content: `${material}\n\nFull outline: ${sections.map((x, j) => `${j + 1}. ${x.title}`).join("; ")}\n\nNow write section ${i + 1}: "${s.title}" — ${s.goal}`,
        },
      ],
      signal: opts.signal,
      meta: { lang: opts.lang, section: s, papers: papers.map((p, j) => ({ label: `P${j + 1}`, title: p.title })), cells: cellMeta },
    });
    for await (const d of stream) {
      const t = filter(d);
      if (!t) continue;
      content += t;
      yield { type: "delta", section: i, text: t };
    }
    updateReport(reportId, { content });
  }

  yield { type: "step", step: "review" };
  const warnings = invalidCitations(content, papers.length);
  updateReport(reportId, { content: content.trim() });
  yield { type: "done", reportId, warnings };
}
