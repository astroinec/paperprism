import { computeInsights } from "@/lib/server/insights";
import { handle, ok, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(computeInsights((await ctx.params).id)));
