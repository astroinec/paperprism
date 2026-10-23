import fs from "node:fs/promises";
import path from "node:path";
import { getPaperFilePath } from "@/lib/server/repo/papers";
import { FILES_DIR } from "@/lib/server/paths";
import { fail, handle, type Ctx } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const file = getPaperFilePath((await ctx.params).id);
  if (!file || !path.resolve(file).startsWith(path.resolve(FILES_DIR))) return fail("No file", 404);
  const buf = await fs.readFile(file).catch(() => null);
  if (!buf) return fail("File missing", 404);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, max-age=3600" },
  });
});
