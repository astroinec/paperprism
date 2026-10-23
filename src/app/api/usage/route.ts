import { stats, usageSummary } from "@/lib/server/repo/usage";
import { handle, ok } from "@/lib/server/http";

export const GET = handle(async (req: Request) => {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 0);
  const since = days > 0 ? Date.now() - days * 86400_000 : 0;
  return ok({ summary: usageSummary(since), stats: stats() });
});
