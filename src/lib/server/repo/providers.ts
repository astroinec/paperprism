import { getDb } from "../db";
import { decrypt, encrypt, mask } from "../crypto";
import { newId } from "../ids";
import type { ModelInfo, Provider, ProviderType } from "@/lib/shared/types";

interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string;
  api_key_enc: string;
  enabled: number;
  created_at: number;
}
interface ModelRow {
  id: string;
  provider_id: string;
  model_id: string;
  label: string | null;
  enabled: number;
  price_in: number | null;
  price_out: number | null;
}

const toModel = (r: ModelRow): ModelInfo => ({
  id: r.id,
  providerId: r.provider_id,
  modelId: r.model_id,
  label: r.label,
  enabled: !!r.enabled,
  priceIn: r.price_in,
  priceOut: r.price_out,
});

function safeDecrypt(s: string) {
  try {
    return decrypt(s);
  } catch {
    return "";
  }
}

function toProvider(r: ProviderRow, models: ModelInfo[]): Provider {
  const key = safeDecrypt(r.api_key_enc);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    baseUrl: r.base_url,
    apiKeyMasked: mask(key),
    hasKey: !!key,
    enabled: !!r.enabled,
    createdAt: r.created_at,
    models,
  };
}

export function listProviders(): Provider[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM providers ORDER BY created_at").all() as ProviderRow[];
  const models = (db.prepare("SELECT * FROM models ORDER BY model_id").all() as ModelRow[]).map(toModel);
  return rows.map((r) => toProvider(r, models.filter((m) => m.providerId === r.id)));
}

export function getProvider(id: string): Provider | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM providers WHERE id=?").get(id) as ProviderRow | undefined;
  if (!r) return null;
  const models = (db.prepare("SELECT * FROM models WHERE provider_id=? ORDER BY model_id").all(id) as ModelRow[]).map(toModel);
  return toProvider(r, models);
}

export interface ProviderSecret {
  id: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  name: string;
}

export function getProviderSecret(id: string): ProviderSecret | null {
  const r = getDb().prepare("SELECT * FROM providers WHERE id=?").get(id) as ProviderRow | undefined;
  if (!r) return null;
  return { id: r.id, type: r.type, baseUrl: r.base_url, apiKey: safeDecrypt(r.api_key_enc), name: r.name };
}

export function createProvider(input: { name: string; type: ProviderType; baseUrl: string; apiKey?: string; models?: string[] }) {
  const db = getDb();
  const id = newId();
  db.prepare("INSERT INTO providers (id,name,type,base_url,api_key_enc,enabled,created_at) VALUES (?,?,?,?,?,1,?)").run(
    id,
    input.name,
    input.type,
    input.baseUrl.trim().replace(/\/+$/, ""),
    encrypt(input.apiKey?.trim() ?? ""),
    Date.now(),
  );
  if (input.models?.length) addModels(id, input.models);
  return getProvider(id)!;
}

export function updateProvider(
  id: string,
  patch: Partial<{ name: string; type: ProviderType; baseUrl: string; apiKey: string; enabled: boolean }>,
) {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.name !== undefined) (sets.push("name=?"), vals.push(patch.name));
  if (patch.type !== undefined) (sets.push("type=?"), vals.push(patch.type));
  if (patch.baseUrl !== undefined) (sets.push("base_url=?"), vals.push(patch.baseUrl.trim().replace(/\/+$/, "")));
  if (patch.apiKey !== undefined) (sets.push("api_key_enc=?"), vals.push(encrypt(patch.apiKey.trim())));
  if (patch.enabled !== undefined) (sets.push("enabled=?"), vals.push(patch.enabled ? 1 : 0));
  if (sets.length) db.prepare(`UPDATE providers SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
  return getProvider(id);
}

export function deleteProvider(id: string) {
  getDb().prepare("DELETE FROM providers WHERE id=?").run(id);
}

export function addModels(providerId: string, modelIds: string[]) {
  const db = getDb();
  const stmt = db.prepare("INSERT OR IGNORE INTO models (id,provider_id,model_id,enabled) VALUES (?,?,?,1)");
  const tx = db.transaction((ids: string[]) => {
    for (const m of ids) if (m.trim()) stmt.run(newId(), providerId, m.trim());
  });
  tx(modelIds);
}

export function updateModel(id: string, patch: Partial<{ enabled: boolean; label: string; priceIn: number | null; priceOut: number | null }>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.enabled !== undefined) (sets.push("enabled=?"), vals.push(patch.enabled ? 1 : 0));
  if (patch.label !== undefined) (sets.push("label=?"), vals.push(patch.label));
  if (patch.priceIn !== undefined) (sets.push("price_in=?"), vals.push(patch.priceIn));
  if (patch.priceOut !== undefined) (sets.push("price_out=?"), vals.push(patch.priceOut));
  if (sets.length) getDb().prepare(`UPDATE models SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
}

export function deleteModel(id: string) {
  getDb().prepare("DELETE FROM models WHERE id=?").run(id);
}

export function findModel(providerId: string, modelId: string): ModelInfo | null {
  const r = getDb().prepare("SELECT * FROM models WHERE provider_id=? AND model_id=?").get(providerId, modelId) as ModelRow | undefined;
  return r ? toModel(r) : null;
}
