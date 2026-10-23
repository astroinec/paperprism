import { searchArxiv } from "@/lib/server/sources/arxiv";
import { searchS2 } from "@/lib/server/sources/s2";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (req: Request, ctx: Ctx<{ source: string }>) => {
  const { source } = await ctx.params;
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return fail("请输入关键词");
  if (source === "arxiv") return ok(await searchArxiv(q));
  if (source === "s2") return ok(await searchS2(q));
  return fail("Unknown source", 404);
});
