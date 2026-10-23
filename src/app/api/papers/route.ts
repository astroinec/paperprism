import { ingestPdf } from "@/lib/server/ingest";
import { listPapers } from "@/lib/server/repo/papers";
import { fail, handle, ok } from "@/lib/server/http";
import type { Paper } from "@/lib/shared/types";

export const GET = handle(async () => ok(listPapers()));

export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (!files.length) return fail("没有收到文件");
  const results: { paper?: Paper; error?: string; name: string }[] = [];
  for (const f of files) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      results.push({ name: f.name, paper: await ingestPdf(buf, { fileName: f.name }) });
    } catch (e) {
      results.push({ name: f.name, error: (e as Error).message });
    }
  }
  return ok({ results }, 201);
});
