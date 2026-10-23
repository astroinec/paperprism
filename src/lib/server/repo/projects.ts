import { getDb } from "../db";
import { newId } from "../ids";
import { toPaper } from "./papers";
import { getTemplate } from "@/lib/shared/templates";
import type { Cell, Dimension, DimensionType, Paper, Project, ProjectDetail } from "@/lib/shared/types";

interface ProjectRow {
  id: string;
  name: string;
  question: string;
  template: string;
  created_at: number;
  updated_at: number;
  paper_count?: number;
}
interface DimRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  type: DimensionType;
  position: number;
  summary: string | null;
}
interface CellRow {
  project_id: string;
  paper_id: string;
  dimension_id: string;
  value: string;
  numeric: number | null;
  quote: string | null;
  page: number | null;
  confidence: Cell["confidence"];
  source: Cell["source"];
  verified: number;
  status: Cell["status"];
  error: string | null;
  edited: number;
  model: string | null;
  updated_at: number;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  question: r.question,
  template: r.template,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  paperCount: r.paper_count,
});
const toDim = (r: DimRow): Dimension => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  description: r.description,
  type: r.type,
  position: r.position,
  summary: r.summary,
});
const toCell = (r: CellRow): Cell => ({
  projectId: r.project_id,
  paperId: r.paper_id,
  dimensionId: r.dimension_id,
  value: r.value,
  numeric: r.numeric,
  quote: r.quote,
  page: r.page,
  confidence: r.confidence,
  source: r.source,
  verified: !!r.verified,
  status: r.status,
  error: r.error,
  edited: !!r.edited,
  model: r.model,
  updatedAt: r.updated_at,
});

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM project_papers pp WHERE pp.project_id=p.id) AS paper_count
       FROM projects p ORDER BY updated_at DESC`,
    )
    .all() as ProjectRow[];
  return rows.map(toProject);
}

export function getProject(id: string): Project | null {
  const r = getDb().prepare("SELECT * FROM projects WHERE id=?").get(id) as ProjectRow | undefined;
  return r ? toProject(r) : null;
}

export function getProjectPapers(id: string): Paper[] {
  const rows = getDb()
    .prepare(
      `SELECT pa.* FROM project_papers pp JOIN papers pa ON pa.id=pp.paper_id
       WHERE pp.project_id=? ORDER BY pp.position, pa.created_at`,
    )
    .all(id) as Parameters<typeof toPaper>[0][];
  return rows.map(toPaper);
}

export function getDimensions(projectId: string): Dimension[] {
  return (getDb().prepare("SELECT * FROM dimensions WHERE project_id=? ORDER BY position").all(projectId) as DimRow[]).map(toDim);
}

export function getCells(projectId: string): Cell[] {
  return (getDb().prepare("SELECT * FROM cells WHERE project_id=?").all(projectId) as CellRow[]).map(toCell);
}

export function getProjectDetail(id: string): ProjectDetail | null {
  const p = getProject(id);
  if (!p) return null;
  return { ...p, papers: getProjectPapers(id), dimensions: getDimensions(id), cells: getCells(id) };
}

export function touchProject(id: string) {
  getDb().prepare("UPDATE projects SET updated_at=? WHERE id=?").run(Date.now(), id);
}

export function createProject(input: { name: string; question?: string; template: string; paperIds: string[]; lang: "zh" | "en" }) {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  const tpl = getTemplate(input.template);
  db.transaction(() => {
    db.prepare("INSERT INTO projects (id,name,question,template,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(
      id,
      input.name,
      input.question ?? "",
      tpl.key,
      now,
      now,
    );
    const pp = db.prepare("INSERT OR IGNORE INTO project_papers (project_id,paper_id,position) VALUES (?,?,?)");
    input.paperIds.forEach((pid, i) => pp.run(id, pid, i));
    const dim = db.prepare("INSERT INTO dimensions (id,project_id,name,description,type,position) VALUES (?,?,?,?,?,?)");
    tpl.dimensions.forEach((d, i) => dim.run(newId(), id, d.name[input.lang], d.description[input.lang], d.type, i));
  })();
  return getProject(id)!;
}

export function updateProject(id: string, patch: Partial<{ name: string; question: string }>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.name !== undefined) (sets.push("name=?"), vals.push(patch.name));
  if (patch.question !== undefined) (sets.push("question=?"), vals.push(patch.question));
  sets.push("updated_at=?");
  vals.push(Date.now());
  getDb().prepare(`UPDATE projects SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
  return getProject(id);
}

export function deleteProject(id: string) {
  getDb().prepare("DELETE FROM projects WHERE id=?").run(id);
}

export function setProjectPapers(id: string, paperIds: string[]) {
  const db = getDb();
  db.transaction(() => {
    const existing = (db.prepare("SELECT paper_id FROM project_papers WHERE project_id=?").all(id) as { paper_id: string }[]).map(
      (r) => r.paper_id,
    );
    const removed = existing.filter((p) => !paperIds.includes(p));
    for (const p of removed) {
      db.prepare("DELETE FROM project_papers WHERE project_id=? AND paper_id=?").run(id, p);
      db.prepare("DELETE FROM cells WHERE project_id=? AND paper_id=?").run(id, p);
    }
    const up = db.prepare(
      "INSERT INTO project_papers (project_id,paper_id,position) VALUES (?,?,?) ON CONFLICT(project_id,paper_id) DO UPDATE SET position=excluded.position",
    );
    paperIds.forEach((p, i) => up.run(id, p, i));
  })();
  touchProject(id);
}

export interface DimensionInput {
  id?: string;
  name: string;
  description: string;
  type: DimensionType;
}

export function saveDimensions(projectId: string, dims: DimensionInput[]) {
  const db = getDb();
  db.transaction(() => {
    const existing = getDimensions(projectId);
    const keep = new Set(dims.map((d) => d.id).filter(Boolean));
    for (const e of existing) if (!keep.has(e.id)) db.prepare("DELETE FROM dimensions WHERE id=?").run(e.id);
    dims.forEach((d, i) => {
      const prev = existing.find((e) => e.id === d.id);
      if (prev) {
        db.prepare("UPDATE dimensions SET name=?, description=?, type=?, position=? WHERE id=?").run(d.name, d.description, d.type, i, d.id);
        if (prev.type !== d.type || prev.description !== d.description || prev.name !== d.name) {
          db.prepare("UPDATE dimensions SET summary=NULL WHERE id=?").run(d.id);
        }
      } else {
        db.prepare("INSERT INTO dimensions (id,project_id,name,description,type,position) VALUES (?,?,?,?,?,?)").run(
          newId(),
          projectId,
          d.name,
          d.description,
          d.type,
          i,
        );
      }
    });
  })();
  touchProject(projectId);
  return getDimensions(projectId);
}

export function setDimensionSummary(id: string, summary: string | null) {
  getDb().prepare("UPDATE dimensions SET summary=? WHERE id=?").run(summary, id);
}

export function upsertCell(c: Omit<Cell, "updatedAt">) {
  getDb()
    .prepare(
      `INSERT INTO cells (project_id,paper_id,dimension_id,value,numeric,quote,page,confidence,source,verified,status,error,edited,model,updated_at)
       VALUES (@projectId,@paperId,@dimensionId,@value,@numeric,@quote,@page,@confidence,@source,@verified,@status,@error,@edited,@model,@updatedAt)
       ON CONFLICT(project_id,paper_id,dimension_id) DO UPDATE SET
         value=excluded.value, numeric=excluded.numeric, quote=excluded.quote, page=excluded.page, confidence=excluded.confidence,
         source=excluded.source, verified=excluded.verified, status=excluded.status, error=excluded.error, edited=excluded.edited,
         model=excluded.model, updated_at=excluded.updated_at`,
    )
    .run({ ...c, verified: c.verified ? 1 : 0, edited: c.edited ? 1 : 0, updatedAt: Date.now() });
}

export function getCell(projectId: string, paperId: string, dimensionId: string): Cell | null {
  const r = getDb()
    .prepare("SELECT * FROM cells WHERE project_id=? AND paper_id=? AND dimension_id=?")
    .get(projectId, paperId, dimensionId) as CellRow | undefined;
  return r ? toCell(r) : null;
}
