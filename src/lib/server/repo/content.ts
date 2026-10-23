import { getDb, json } from "../db";
import { newId } from "../ids";
import type { Chat, Message, OutlineSection, Report, ReportStyle, Source } from "@/lib/shared/types";

interface ReportRow {
  id: string;
  project_id: string;
  style: ReportStyle;
  language: "zh" | "en";
  outline: string;
  content: string;
  model: string | null;
  created_at: number;
  updated_at: number;
}
const toReport = (r: ReportRow): Report => ({
  id: r.id,
  projectId: r.project_id,
  style: r.style,
  language: r.language,
  outline: json<OutlineSection[]>(r.outline, []),
  content: r.content,
  model: r.model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function listReports(projectId: string): Report[] {
  return (getDb().prepare("SELECT * FROM reports WHERE project_id=? ORDER BY created_at DESC").all(projectId) as ReportRow[]).map(toReport);
}
export function getReport(id: string): Report | null {
  const r = getDb().prepare("SELECT * FROM reports WHERE id=?").get(id) as ReportRow | undefined;
  return r ? toReport(r) : null;
}
export function createReport(r: { projectId: string; style: ReportStyle; language: "zh" | "en"; model: string | null }) {
  const id = newId();
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO reports (id,project_id,style,language,outline,content,model,created_at,updated_at) VALUES (?,?,?,?,'[]','',?,?,?)")
    .run(id, r.projectId, r.style, r.language, r.model, now, now);
  return id;
}
export function updateReport(id: string, patch: Partial<{ outline: OutlineSection[]; content: string }>) {
  const sets: string[] = ["updated_at=?"];
  const vals: unknown[] = [Date.now()];
  if (patch.outline) (sets.push("outline=?"), vals.push(JSON.stringify(patch.outline)));
  if (patch.content !== undefined) (sets.push("content=?"), vals.push(patch.content));
  getDb().prepare(`UPDATE reports SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
  return getReport(id);
}
export function deleteReport(id: string) {
  getDb().prepare("DELETE FROM reports WHERE id=?").run(id);
}

interface ChatRow {
  id: string;
  project_id: string;
  title: string;
  created_at: number;
}
interface MsgRow {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  sources: string;
  created_at: number;
}
const toChat = (r: ChatRow): Chat => ({ id: r.id, projectId: r.project_id, title: r.title, createdAt: r.created_at });
const toMsg = (r: MsgRow): Message => ({
  id: r.id,
  chatId: r.chat_id,
  role: r.role,
  content: r.content,
  sources: json<Source[]>(r.sources, []),
  createdAt: r.created_at,
});

export function listChats(projectId: string): Chat[] {
  return (getDb().prepare("SELECT * FROM chats WHERE project_id=? ORDER BY created_at DESC").all(projectId) as ChatRow[]).map(toChat);
}
export function getChat(id: string): Chat | null {
  const r = getDb().prepare("SELECT * FROM chats WHERE id=?").get(id) as ChatRow | undefined;
  return r ? toChat(r) : null;
}
export function createChat(projectId: string, title: string) {
  const id = newId();
  getDb().prepare("INSERT INTO chats (id,project_id,title,created_at) VALUES (?,?,?,?)").run(id, projectId, title, Date.now());
  return getChat(id)!;
}
export function renameChat(id: string, title: string) {
  getDb().prepare("UPDATE chats SET title=? WHERE id=?").run(title, id);
}
export function deleteChat(id: string) {
  getDb().prepare("DELETE FROM chats WHERE id=?").run(id);
}
export function listMessages(chatId: string): Message[] {
  return (getDb().prepare("SELECT * FROM messages WHERE chat_id=? ORDER BY created_at, rowid").all(chatId) as MsgRow[]).map(toMsg);
}
export function addMessage(chatId: string, role: "user" | "assistant", content: string, sources: Source[] = []) {
  const id = newId();
  getDb()
    .prepare("INSERT INTO messages (id,chat_id,role,content,sources,created_at) VALUES (?,?,?,?,?,?)")
    .run(id, chatId, role, content, JSON.stringify(sources), Date.now());
  return id;
}
