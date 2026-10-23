import { createChat, listChats } from "@/lib/server/repo/content";
import { handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(listChats((await ctx.params).id)));

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const b = (await req.json().catch(() => ({}))) as { title?: string };
  return ok(createChat((await ctx.params).id, b.title?.trim() || "New chat"), 201);
});
