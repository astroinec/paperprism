import { createProvider, listProviders } from "@/lib/server/repo/providers";
import { fail, handle, ok } from "@/lib/server/http";
import type { ProviderType } from "@/lib/shared/types";

const TYPES: ProviderType[] = ["openai", "anthropic", "ollama"];

export const GET = handle(async () => ok(listProviders()));

export const POST = handle(async (req: Request) => {
  const b = (await req.json()) as { name?: string; type?: ProviderType; baseUrl?: string; apiKey?: string; models?: string[] };
  if (!b.name?.trim()) return fail("名称不能为空");
  if (!b.type || !TYPES.includes(b.type)) return fail("不支持的类型");
  if (!b.baseUrl?.trim()) return fail("Base URL 不能为空");
  return ok(createProvider({ name: b.name.trim(), type: b.type, baseUrl: b.baseUrl, apiKey: b.apiKey, models: b.models }), 201);
});
