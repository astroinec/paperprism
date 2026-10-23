export type ProviderType = "openai" | "anthropic" | "ollama" | "mock";

export interface ModelInfo {
  id: string;
  providerId: string;
  modelId: string;
  label: string | null;
  enabled: boolean;
  priceIn: number | null;
  priceOut: number | null;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyMasked: string;
  hasKey: boolean;
  enabled: boolean;
  createdAt: number;
  models: ModelInfo[];
}

export interface ModelRef {
  providerId: string;
  modelId: string;
}

export type TaskKind = "extract" | "report" | "chat" | "suggest";

export interface ServerSettings {
  activeModel: ModelRef | null;
  taskModels: Partial<Record<TaskKind, ModelRef | null>>;
  temperature: number;
  maxTokens: number;
  concurrency: number;
  contextChars: number;
}

export type PaperStatus = "ready" | "no_text" | "error" | "processing";
export type PaperSource = "upload" | "arxiv" | "s2" | "url" | "text";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxivId: string | null;
  abstract: string | null;
  url: string | null;
  source: PaperSource;
  hasFile: boolean;
  numPages: number;
  status: PaperStatus;
  error: string | null;
  tags: string[];
  citationCount: number | null;
  createdAt: number;
}

export type DimensionType = "text" | "number" | "rating" | "tags";

export interface Dimension {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: DimensionType;
  position: number;
  summary: string | null;
}

export type Confidence = "high" | "medium" | "low";
export type CellSource = "stated" | "inferred" | "not_found";

export interface Cell {
  projectId: string;
  paperId: string;
  dimensionId: string;
  value: string;
  numeric: number | null;
  quote: string | null;
  page: number | null;
  confidence: Confidence | null;
  source: CellSource | null;
  verified: boolean;
  status: "done" | "error";
  error: string | null;
  edited: boolean;
  model: string | null;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  question: string;
  template: string;
  createdAt: number;
  updatedAt: number;
  paperCount?: number;
}

export interface ProjectDetail extends Project {
  papers: Paper[];
  dimensions: Dimension[];
  cells: Cell[];
}

export interface OutlineSection {
  title: string;
  goal: string;
}

export type ReportStyle = "academic" | "brief" | "related_work";

export interface Report {
  id: string;
  projectId: string;
  style: ReportStyle;
  language: "zh" | "en";
  outline: OutlineSection[];
  content: string;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Source {
  paperIndex: number;
  paperId: string;
  title: string;
  page: number;
  text: string;
}

export interface Chat {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: number;
}

export interface SearchResult {
  source: "arxiv" | "s2";
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  doi: string | null;
  arxivId: string | null;
  pdfUrl: string | null;
  url: string | null;
  citationCount: number | null;
}

export type ReportEvent =
  | { type: "step"; step: "plan" | "draft" | "review"; section?: number }
  | { type: "outline"; sections: OutlineSection[] }
  | { type: "delta"; section: number; text: string }
  | { type: "done"; reportId: string; warnings: string[] }
  | { type: "error"; message: string };

export type ChatEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; userMessageId: string }
  | { type: "error"; message: string };

export interface UsageSummary {
  model: string;
  providerId: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}
