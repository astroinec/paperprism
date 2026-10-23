import { errorText, readSSE } from "./sse";
import { LLMError, type LLMRequest, type ResolvedTarget, type Usage } from "./types";

function chatBase(t: ResolvedTarget) {
  if (t.type === "ollama") return `${t.baseUrl.replace(/\/v1$/, "")}/v1`;
  return t.baseUrl;
}

export async function* openaiStream(t: ResolvedTarget, req: LLMRequest): AsyncGenerator<string, Usage | undefined> {
  const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages];
  const body: Record<string, unknown> = {
    model: t.modelId,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens) body.max_tokens = req.maxTokens;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t.apiKey) headers.Authorization = `Bearer ${t.apiKey}`;
  if (t.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "PaperPrism";
  }

  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${chatBase(t)}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: req.signal,
    });
    if (res.ok) break;
    const msg = await errorText(res);
    if (res.status === 400 || res.status === 422) {
      const lower = msg.toLowerCase();
      if (lower.includes("stream_options") && body.stream_options) {
        delete body.stream_options;
        continue;
      }
      if (lower.includes("max_tokens") && body.max_tokens) {
        body.max_completion_tokens = body.max_tokens;
        delete body.max_tokens;
        continue;
      }
      if (lower.includes("temperature") && body.temperature !== undefined) {
        delete body.temperature;
        continue;
      }
    }
    throw new LLMError(`[${res.status}] ${msg.slice(0, 500)}`, res.status);
  }
  if (!res || !res.ok) throw new LLMError("Request failed", 500);

  let usage: Usage | undefined;
  for await (const data of readSSE(res)) {
    if (!data || data === "[DONE]") continue;
    let j: {
      choices?: { delta?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    if (j.error) throw new LLMError(j.error.message ?? "Stream error", 502);
    const delta = j.choices?.[0]?.delta?.content;
    if (delta) yield delta;
    if (j.usage) usage = { inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0 };
  }
  return usage;
}

export async function openaiListModels(t: Pick<ResolvedTarget, "type" | "baseUrl" | "apiKey">): Promise<string[]> {
  if (t.type === "ollama") {
    const res = await fetch(`${t.baseUrl.replace(/\/v1$/, "")}/api/tags`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new LLMError(await errorText(res), res.status);
    const j = (await res.json()) as { models?: { name: string }[] };
    return (j.models ?? []).map((m) => m.name);
  }
  const headers: Record<string, string> = {};
  if (t.apiKey) headers.Authorization = `Bearer ${t.apiKey}`;
  const res = await fetch(`${t.baseUrl}/models`, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new LLMError(`[${res.status}] ${await errorText(res)}`, res.status);
  const j = (await res.json()) as { data?: { id: string }[] };
  return (j.data ?? []).map((m) => m.id).sort();
}
