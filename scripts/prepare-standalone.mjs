// Assembles dist-app/server from `next build` standalone output (adds static assets, verifies native module).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const out = path.join(root, "dist-app", "server");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js - run `next build` first (output: 'standalone').");
  process.exit(1);
}

fs.rmSync(path.join(root, "dist-app"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(standalone, out, { recursive: true, dereference: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true });
const pub = path.join(root, "public");
if (fs.existsSync(pub)) fs.cpSync(pub, path.join(out, "public"), { recursive: true });

// The local data directory must never ship in the installer.
fs.rmSync(path.join(out, "data"), { recursive: true, force: true });

// Turbopack emits hashed externals (.next/node_modules/<pkg>-<hash>) as absolute symlinks into the build machine.
// Replace them with real copies so the installed app is self-contained (also avoids symlink privileges on Windows).
const hashed = path.join(out, ".next", "node_modules");
if (fs.existsSync(hashed)) {
  for (const name of fs.readdirSync(hashed)) {
    const link = path.join(hashed, name);
    const pkg = name.replace(/-[0-9a-f]{16}$/, "");
    const src = path.join(out, "node_modules", pkg);
    if (!fs.existsSync(src)) {
      console.error(`External ${name}: ${src} not found in standalone output`);
      process.exit(1);
    }
    fs.rmSync(link, { recursive: true, force: true });
    fs.cpSync(src, link, { recursive: true, dereference: true });
  }
}

// better-sqlite3 ships prebuilt binaries for every platform; tracing may keep only the build host's one.
const prebuilds = path.join(out, "node_modules", "better-sqlite3", "prebuilds");
const srcPrebuilds = path.join(root, "node_modules", "better-sqlite3", "prebuilds");
for (const dir of [prebuilds, path.join(hashed, fs.readdirSync(hashed).find((n) => n.startsWith("better-sqlite3")) ?? "x", "prebuilds")]) {
  if (fs.existsSync(srcPrebuilds) && fs.existsSync(path.dirname(dir))) fs.cpSync(srcPrebuilds, dir, { recursive: true });
}
const win = path.join(prebuilds, "win32-x64.node");
if (!fs.existsSync(win)) {
  console.error("better-sqlite3 win32-x64 prebuild missing: " + win);
  process.exit(1);
}
console.log("dist-app/server ready");
