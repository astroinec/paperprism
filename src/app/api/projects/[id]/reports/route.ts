import { generateReport } from "@/lib/server/agents/report";
import { listReports } from "@/lib/server/repo/content";
import { handle, langOf, ndjson, ok, type Ctx } from "@/lib/server/http";
import type { ReportStyle } from "@/lib/shared/types";

export const maxDuration = 600;

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(listReports((await ctx.params).id)));

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { style?: ReportStyle; lang?: string };
  const style: ReportStyle = b.style && ["academic", "brief", "related_work"].includes(b.style) ? b.style : "academic";
  return ndjson((signal) => generateReport({ projectId: id, style, lang: langOf(b.lang), signal }), req);
});
