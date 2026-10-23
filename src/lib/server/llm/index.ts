import { getProviderSecret } from "../repo/providers";
import { getSettings } from "../repo/settings";
import { recordUsage } from "../repo/usage";
import { anthropicListModels, anthropicStream } from "./anthropic";
import { mockStream } from "./mock";
import { openaiListModels, openaiStream } from "./openai";
import { LLMError, type LLMRequest, type ResolvedTarget, type StreamFn, type Usage } from "./types";
import type { ModelRef, ProviderType, TaskKind } from "@/lib/shared/types";

export { LLMError } from "./types";
export type { LLMRequest, ChatMsg } from "./types";

const STREAMERS: Record<ProviderType, StreamFn> = {
  openai: openaiStream,
  ollama: openaiStream,
  anthropic: anthropicStream,
  mock: mockStream,
};

export function resolveTarget(ref?: ModelRef | null, task?: TaskKind): ResolvedTarget {
  const s = getSettings();
  const r = ref ?? (task ? s.taskModels[task] : null) ?? s.activeModel;
  if (!r) throw new LLMError("NO_MODEL: 请先在「API 配置」中添加并选择一个模型", 400);
  const p = getProviderSecret(r.providerId);
  if (!p) throw new LLMError("NO_MODEL: 当前选择的服务商不存在，请重新选择模型", 400);
  return { providerId: p.id, providerName: p.name, type: p.type, baseUrl: p.baseUrl, apiKey: p.apiKey, modelId: r.modelId };
}

export interface StreamResult {
  stream: AsyncGenerator<string, void>;
  model: string;
}

/** Streams text deltas and records usage when finished. */
export async function* streamLLM(target: ResolvedTarget, req: LLMRequest): AsyncGenerator<string, void> {
  const s = getSettings();
  const full: LLMRequest = {
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    ...req,
    signal: req.signal ? AbortSignal.any([req.signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),
  };
  const started = Date.now();
  let outChars = 0;
  let usage: Usage | undefined;
  const gen = STREAMERS[target.type](target, full);
  let failed = false;
  try {
    while (true) {
      const n = await gen.next();
      if (n.done) {
        usage = n.value;
        break;
      }
      outChars += n.value.length;
      yield n.value;
    }
  } catch (e) {
    failed = true;
    if (e instanceof LLMError) throw e;
    const err = e as Error & { cause?: { code?: string } };
    if (err.name === "TimeoutError") throw new LLMError("请求超时", 504);
    if (err.name === "AbortError") throw new LLMError("请求已取消", 499);
    const code = err.cause?.code ? ` (${err.cause.code})` : "";
    throw new LLMError(`网络错误：${err.message}${code}`, 502);
  } finally {
    // Skip failed requests that produced nothing (e.g. bad URL / auth) so they don't inflate usage.
    if (!(failed && outChars === 0 && !usage)) {
      const inChars = (full.system?.length ?? 0) + full.messages.reduce((a, m) => a + m.content.length, 0);
      recordUsage({
        providerId: target.providerId,
        model: target.modelId,
        task: req.task,
        inputTokens: usage?.inputTokens || Math.ceil(inChars / 4),
        outputTokens: usage?.outputTokens || Math.ceil(outChars / 4),
        latencyMs: Date.now() - started,
      });
    }
  }
}

export async function generateLLM(target: ResolvedTarget, req: LLMRequest): Promise<string> {
  let text = "";
  for await (const d of streamLLM(target, req)) text += d;
  return text;
}

export async function listRemoteModels(providerId: string): Promise<string[]> {
  const p = getProviderSecret(providerId);
  if (!p) throw new LLMError("Provider not found", 404);
  if (p.type === "mock") return ["prism-demo"];
  if (p.type === "anthropic") return anthropicListModels(p);
  return openaiListModels(p);
}

export async function testProvider(providerId: string, modelId: string) {
  const target = resolveTarget({ providerId, modelId });
  const started = Date.now();
  const text = await generateLLM(target, {
    task: "test",
    messages: [{ role: "user", content: "Reply with the single word: pong" }],
    maxTokens: 16,
    temperature: 0,
  });
  return { latencyMs: Date.now() - started, reply: text.trim().slice(0, 80) };
}
