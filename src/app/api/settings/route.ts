import { getSettings, updateSettings } from "@/lib/server/repo/settings";
import { handle, ok } from "@/lib/server/http";

export const GET = handle(async () => ok(getSettings()));

export const PATCH = handle(async (req: Request) => {
  const b = await req.json();
  if (b.concurrency !== undefined) b.concurrency = Math.max(1, Math.min(10, Number(b.concurrency) || 3));
  if (b.contextChars !== undefined) b.contextChars = Math.max(8000, Math.min(400000, Number(b.contextChars) || 60000));
  return ok(updateSettings(b));
});
