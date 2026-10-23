import { answer } from "@/lib/server/agents/chat";
import { fail, handle, langOf, ndjson, type Ctx } from "@/lib/server/http";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { question?: string; paperIds?: string[]; lang?: string };
  if (!b.question?.trim()) return fail("问题不能为空");
  return ndjson((signal) => answer({ chatId: id, question: b.question!.trim(), paperIds: b.paperIds, lang: langOf(b.lang), signal }), req);
});
