import type { ProviderType } from "@/lib/shared/types";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMRequest {
  task: string;
  system?: string;
  messages: ChatMsg[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Structured hints consumed only by the offline mock provider */
  meta?: Record<string, unknown>;
}

export interface ResolvedTarget {
  providerId: string;
  providerName: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

export class LLMError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type StreamFn = (t: ResolvedTarget, req: LLMRequest) => AsyncGenerator<string, Usage | undefined>;
