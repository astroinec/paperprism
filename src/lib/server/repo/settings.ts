import { getDb, json } from "../db";
import type { ServerSettings } from "@/lib/shared/types";

const DEFAULTS: ServerSettings = {
  activeModel: null,
  taskModels: {},
  temperature: 0.2,
  maxTokens: 4096,
  concurrency: 3,
  contextChars: 60000,
};

export function getSettings(): ServerSettings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) {
    if (r.key in DEFAULTS) out[r.key] = json(r.value, (DEFAULTS as unknown as Record<string, unknown>)[r.key]);
  }
  return out as unknown as ServerSettings;
}

export function updateSettings(patch: Partial<ServerSettings>) {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULTS) stmt.run(k, JSON.stringify(v));
  }
  return getSettings();
}
