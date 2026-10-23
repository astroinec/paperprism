import { getDb } from "../db";
import type { UsageSummary } from "@/lib/shared/types";

export function recordUsage(u: {
  providerId: string;
  model: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}) {
  getDb()
    .prepare("INSERT INTO usage (provider_id,model,task,input_tokens,output_tokens,latency_ms,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(u.providerId, u.model, u.task, u.inputTokens, u.outputTokens, u.latencyMs, Date.now());
}

export function usageSummary(sinceMs = 0): UsageSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT u.provider_id providerId, u.model model, COUNT(*) calls, SUM(u.input_tokens) inputTokens, SUM(u.output_tokens) outputTokens,
              m.price_in priceIn, m.price_out priceOut
       FROM usage u LEFT JOIN models m ON m.provider_id=u.provider_id AND m.model_id=u.model
       WHERE u.created_at >= ? GROUP BY u.provider_id, u.model ORDER BY calls DESC`,
    )
    .all(sinceMs) as (UsageSummary & { priceIn: number | null; priceOut: number | null })[];
  return rows.map(({ priceIn, priceOut, ...r }) => ({
    ...r,
    cost: priceIn != null || priceOut != null ? ((priceIn ?? 0) * r.inputTokens + (priceOut ?? 0) * r.outputTokens) / 1e6 : null,
  }));
}

export function stats() {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    papers: one("SELECT COUNT(*) c FROM papers"),
    projects: one("SELECT COUNT(*) c FROM projects"),
    cells: one("SELECT COUNT(*) c FROM cells WHERE status='done'"),
    tokens: one("SELECT COALESCE(SUM(input_tokens+output_tokens),0) c FROM usage"),
  };
}
