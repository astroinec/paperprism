import { importByUrl, importSearchResult, importText } from "@/lib/server/ingest";
import { fail, handle, ok } from "@/lib/server/http";
import type { SearchResult } from "@/lib/shared/types";

export const POST = handle(async (req: Request) => {
  const b = (await req.json()) as
    | { kind: "search"; result: SearchResult }
    | { kind: "url"; url: string }
    | { kind: "text"; title: string; text: string; authors?: string[]; year?: number | null };
  switch (b.kind) {
    case "search":
      return ok(await importSearchResult(b.result), 201);
    case "url":
      if (!b.url?.trim()) return fail("请输入链接");
      return ok(await importByUrl(b.url), 201);
    case "text":
      if (!b.text?.trim()) return fail("请输入文本");
      return ok({ paper: importText(b) }, 201);
    default:
      return fail("Unknown import kind");
  }
});
