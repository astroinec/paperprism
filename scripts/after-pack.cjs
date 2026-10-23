// electron-builder silently drops any "node_modules" folder from extraResources, so copy the server verbatim here.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, "dist-app", "server");
  const dest = path.join(context.appOutDir, "resources", "server");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  const native = path.join(dest, "node_modules", "better-sqlite3", "prebuilds", "win32-x64.node");
  if (!fs.existsSync(native)) throw new Error("afterPack: missing " + native);
  console.log("afterPack: server copied to", dest);
};
