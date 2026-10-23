import { resolveTarget, streamLLM } from "../llm";
import { createThinkFilter } from "../llm/think";
import { chunkPages, searchChunks } from "../retrieval";
import { getPages } from "../repo/papers";
import { getProject, getProjectPapers } from "../repo/projects";
import { addMessage, getChat, listMessages, renameChat } from "../repo/content";
import type { ChatEvent, Source } from "@/lib/shared/types";

export async function* answer(opts: {
  chatId: string;
  question: string;
  paperIds?: string[];
  lang: "zh" | "en";
  signal?: AbortSignal;
}): AsyncGenerator<ChatEvent> {
  const chat = getChat(opts.chatId);
  if (!chat) throw new Error("Chat not found");
  const project = getProject(chat.projectId);
  const papers = getProjectPapers(chat.projectId);
  const history = listMessages(opts.chatId).slice(-12);
  const userMessageId = addMessage(opts.chatId, "user", opts.question);
  if (history.length === 0) renameChat(opts.chatId, opts.question.slice(0, 40));

  const scope = papers.map((p, i) => ({ p, i })).filter(({ p }) => !opts.paperIds?.length || opts.paperIds.includes(p.id));
  const chunks = scope.flatMap(({ p, i }) => {
    const pages = getPages(p.id);
    return chunkPages(pages.length ? pages : [`${p.title}\n${p.abstract ?? ""}`], p.id, i + 1);
  });
  const query = `${opts.question} ${history.filter((m) => m.role === "user").slice(-1).map((m) => m.content).join(" ")}`;
  let hits = searchChunks(chunks, query, 10);
  // Make sure every paper in scope contributes at least one passage for comparative questions
  for (const { p } of scope) {
    if (!hits.some((h) => h.paperId === p.id)) {
      const best = searchChunks(chunks.filter((c) => c.paperId === p.id), query, 1)[0] ?? chunks.find((c) => c.paperId === p.id);
      if (best) hits.push({ ...best, score: 0 });
    }
  }
  hits = hits.slice(0, 14);

  const sources: Source[] = hits.map((h) => ({
    paperIndex: h.paperIndex,
    paperId: h.paperId,
    title: papers[h.paperIndex - 1]?.title ?? "",
    page: h.page,
    text: h.text,
  }));
  yield { type: "sources", sources };

  const target = resolveTarget(null, "chat");
  const paperList = papers.map((p, i) => `P${i + 1}: ${p.title}${p.year ? ` (${p.year})` : ""}`).join("\n");
  const ctx = sources.map((s) => `[P${s.paperIndex}, p.${s.page}]\n${s.text}`).join("\n\n---\n\n");
  const system = `You are a research assistant answering questions about a set of papers${project?.question ? ` (comparison goal: ${project.question})` : ""}.
Papers:
${paperList}

Answer using ONLY the passages below. Cite every claim inline as [P{n}, p.{page}] exactly matching the passage labels. If the passages do not contain the answer, say so honestly.
Answer in ${opts.lang === "zh" ? "Simplified Chinese" : "English"} using Markdown (tables welcome for comparisons).

Passages:
${ctx}`;

  const filter = createThinkFilter();
  let content = "";
  const stream = streamLLM(target, {
    task: "chat",
    system,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: opts.question }],
    signal: opts.signal,
    meta: { lang: opts.lang, question: opts.question, sources: sources.map((s) => ({ label: `P${s.paperIndex}`, page: s.page, text: s.text })) },
  });
  for await (const d of stream) {
    const t = filter(d);
    if (!t) continue;
    content += t;
    yield { type: "delta", text: t };
  }
  const messageId = addMessage(opts.chatId, "assistant", content.trim(), sources);
  yield { type: "done", messageId, userMessageId };
}
