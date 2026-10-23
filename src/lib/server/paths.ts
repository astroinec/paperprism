import path from "node:path";
import fs from "node:fs";

export const DATA_DIR = process.env.PAPERPRISM_DATA_DIR || path.join(process.cwd(), "data");
export const FILES_DIR = path.join(DATA_DIR, "files");

export function ensureDirs() {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}
