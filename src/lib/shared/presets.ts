import type { ProviderType } from "./types";

export interface ProviderPreset {
  key: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  models: string[];
  needsKey: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: "openai", name: "OpenAI", type: "openai", baseUrl: "https://api.openai.com/v1", models: [], needsKey: true },
  { key: "deepseek", name: "DeepSeek", type: "openai", baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"], needsKey: true },
  { key: "qwen", name: "通义千问 · 百炼", type: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: [], needsKey: true },
  { key: "moonshot", name: "Kimi · Moonshot", type: "openai", baseUrl: "https://api.moonshot.cn/v1", models: [], needsKey: true },
  { key: "zhipu", name: "智谱 GLM", type: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: [], needsKey: true },
  { key: "siliconflow", name: "硅基流动 SiliconFlow", type: "openai", baseUrl: "https://api.siliconflow.cn/v1", models: [], needsKey: true },
  { key: "openrouter", name: "OpenRouter", type: "openai", baseUrl: "https://openrouter.ai/api/v1", models: [], needsKey: true },
  { key: "anthropic", name: "Anthropic", type: "anthropic", baseUrl: "https://api.anthropic.com", models: [], needsKey: true },
  { key: "ollama", name: "Ollama (本地)", type: "ollama", baseUrl: "http://localhost:11434", models: [], needsKey: false },
  { key: "custom", name: "自定义 OpenAI 兼容", type: "openai", baseUrl: "", models: [], needsKey: true },
];
