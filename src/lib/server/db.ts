import Database from "better-sqlite3";
import path from "node:path";
import { DATA_DIR, ensureDirs } from "./paths";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, base_url TEXT NOT NULL DEFAULT '',
  api_key_enc TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL, label TEXT, enabled INTEGER NOT NULL DEFAULT 1, price_in REAL, price_out REAL,
  UNIQUE(provider_id, model_id)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, authors TEXT NOT NULL DEFAULT '[]', year INTEGER, venue TEXT,
  doi TEXT, arxiv_id TEXT, abstract TEXT, url TEXT, source TEXT NOT NULL, file_path TEXT,
  num_pages INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ready', error TEXT,
  tags TEXT NOT NULL DEFAULT '[]', citation_count INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE, page_no INTEGER NOT NULL, text TEXT NOT NULL,
  PRIMARY KEY (paper_id, page_no)
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, question TEXT NOT NULL DEFAULT '', template TEXT NOT NULL DEFAULT 'general',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_papers (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (project_id, paper_id)
);
CREATE TABLE IF NOT EXISTS dimensions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'text',
  position INTEGER NOT NULL DEFAULT 0, summary TEXT
);
CREATE TABLE IF NOT EXISTS cells (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT '', numeric REAL, quote TEXT, page INTEGER, confidence TEXT, source TEXT,
  verified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'done', error TEXT,
  edited INTEGER NOT NULL DEFAULT 0, model TEXT, updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, paper_id, dimension_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  style TEXT NOT NULL, language TEXT NOT NULL, outline TEXT NOT NULL DEFAULT '[]', content TEXT NOT NULL DEFAULT '',
  model TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id TEXT, model TEXT, task TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cells_project ON cells(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
`;

const g = globalThis as unknown as { __ppDb?: Database.Database };

function seed(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) c FROM providers").get() as { c: number };
  if (count.c > 0) return;
  const now = Date.now();
  db.prepare("INSERT INTO providers (id,name,type,base_url,api_key_enc,enabled,created_at) VALUES (?,?,?,?,?,?,?)").run(
    "mock",
    "Demo (离线演示)",
    "mock",
    "",
    "",
    1,
    now,
  );
  db.prepare("INSERT INTO models (id,provider_id,model_id,label,enabled) VALUES (?,?,?,?,1)").run(
    "mock-model",
    "mock",
    "prism-demo",
    "Prism Demo",
  );
  db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").run(
    "activeModel",
    JSON.stringify({ providerId: "mock", modelId: "prism-demo" }),
  );
}

export function getDb(): Database.Database {
  if (g.__ppDb) return g.__ppDb;
  ensureDirs();
  const db = new Database(path.join(DATA_DIR, "paperprism.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seed(db);
  g.__ppDb = db;
  return db;
}

export function json<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
