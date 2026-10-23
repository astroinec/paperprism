import { LLMError } from "./llm/types";

export type Ctx<T extends Record<string, string> = { id: string }> = { params: Promise<T> };

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const err = e as Error;
      const status = e instanceof LLMError ? (err as LLMError).status : 500;
      console.error("[api]", err);
      return fail(err.message || "Internal error", status >= 400 && status < 600 ? status : 500);
    }
  };
}

export function ndjson<T>(gen: (signal: AbortSignal) => AsyncGenerator<T>, req: Request): Response {
  const enc = new TextEncoder();
  const ctrl = new AbortController();
  req.signal.addEventListener("abort", () => ctrl.abort());
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of gen(ctrl.signal)) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        controller.enqueue(enc.encode(JSON.stringify({ type: "error", message: (e as Error).message }) + "\n"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      ctrl.abort();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

export function download(body: BodyInit, filename: string, type: string) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "export";
}

export function langOf(v: unknown): "zh" | "en" {
  return v === "en" ? "en" : "zh";
}
