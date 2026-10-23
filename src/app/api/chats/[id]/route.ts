import { deleteChat, getChat, listMessages } from "@/lib/server/repo/content";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const c = getChat(id);
  return c ? ok({ ...c, messages: listMessages(id) }) : fail("Not found", 404);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteChat((await ctx.params).id);
  return ok({ ok: true });
});
