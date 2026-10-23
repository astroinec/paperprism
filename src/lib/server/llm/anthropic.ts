import { errorText, readSSE } from "./sse";
import { LLMError, type LLMRequest, type ResolvedTarget, type Usage } from "./types";

function base(t: { baseUrl: string }) {
  return (t.baseUrl || "https://api.anthropic.com").replace(/\/v1$/, "");
}

function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}

export async function* anthropicStream(t: ResolvedTarget, req: LLMRequest): AsyncGenerator<string, Usage | undefined> {
  const body: Record<string, unknown> = {
    model: t.modelId,
    messages: req.messages,
    max_tokens: req.maxTokens ?? 4096,
    stream: true,
  };
  if (req.system) body.system = req.system;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const res = await fetch(`${base(t)}/v1/messages`, {
    method: "POST",
    headers: headers(t.apiKey),
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok) throw new LLMError(`[${res.status}] ${(await errorText(res)).slice(0, 500)}`, res.status);

  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  for await (const data of readSSE(res)) {
    if (!data) continue;
    let j: {
      type?: string;
      delta?: { type?: string; text?: string };
      message?: { usage?: { input_tokens?: number; output_tokens?: number } };
      usage?: { output_tokens?: number; input_tokens?: number };
      error?: { message?: string };
    };
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    if (j.type === "error") throw new LLMError(j.error?.message ?? "Stream error", 502);
    if (j.type === "message_start" && j.message?.usage) {
      usage.inputTokens = j.message.usage.input_tokens ?? 0;
      usage.outputTokens = j.message.usage.output_tokens ?? 0;
    }
    if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) yield j.delta.text;
    if (j.type === "message_delta" && j.usage) {
      usage.outputTokens = j.usage.output_tokens ?? usage.outputTokens;
      if (j.usage.input_tokens) usage.inputTokens = j.usage.input_tokens;
    }
  }
  return usage;
}

export async function anthropicListModels(t: { baseUrl: string; apiKey: string }): Promise<string[]> {
  const res = await fetch(`${base(t)}/v1/models?limit=100`, { headers: headers(t.apiKey), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new LLMError(`[${res.status}] ${await errorText(res)}`, res.status);
  const j = (await res.json()) as { data?: { id: string }[] };
  return (j.data ?? []).map((m) => m.id);
}
