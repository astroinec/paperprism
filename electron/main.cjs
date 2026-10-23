// PaperPrism desktop shell: starts the bundled Next.js server on a free local port and shows it in a window.
const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const PACKAGED = app.isPackaged;
const NODE_BIN = PACKAGED ? path.join(process.resourcesPath, "node.exe") : process.env.PP_NODE || "node";
const SERVER_JS = PACKAGED ? path.join(process.resourcesPath, "server", "server.js") : path.join(__dirname, "..", "dist-app", "server", "server.js");

let win = null;
let server = null;
let quitting = false;

const LOADING_HTML = `<!doctype html><meta charset="utf-8"><style>
html,body{height:100%;margin:0;font:14px -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#1c2030}
body{display:grid;place-items:center;background:radial-gradient(ellipse at 0 0,#dbe8ff,transparent 60%),radial-gradient(ellipse at 100% 100%,#f1dcff,transparent 55%),#e8edfa}
.c{display:flex;flex-direction:column;align-items:center;gap:18px}
.logo{width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#4aa3ff,#7b5cff);box-shadow:0 14px 34px -10px rgba(60,80,230,.6),inset 0 1px 0 rgba(255,255,255,.5)}
.bar{width:140px;height:4px;border-radius:4px;background:rgba(0,0,0,.08);overflow:hidden}
.bar i{display:block;width:40%;height:100%;border-radius:4px;background:#0a84ff;animation:m 1.1s ease-in-out infinite}
@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
</style><div class="c"><div class="logo"></div><div>PaperPrism</div><div class="bar"><i></i></div></div>`;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function waitReady(port, isDead, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (isDead()) return reject(new Error("server exited"));
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", retry);
      req.on("timeout", () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for server"));
      setTimeout(tick, 250);
    };
    tick();
  });
}

function startServer(port, logFile) {
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const log = fs.openSync(logFile, "w");
  const child = spawn(NODE_BIN, [SERVER_JS], {
    cwd: path.dirname(SERVER_JS),
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", PAPERPRISM_DATA_DIR: dataDir, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  child.exited = false;
  child.on("exit", () => {
    child.exited = true;
    if (!quitting) {
      dialog.showErrorBox("PaperPrism", `后台服务意外退出。\nBackground service stopped.\n\n${logFile}`);
      app.quit();
    }
  });
  child.on("error", (e) => {
    child.exited = true;
    fs.writeSync(log, `spawn error: ${e.message}\n`);
  });
  return child;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#e8edfa",
    title: "PaperPrism",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(LOADING_HTML));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => (win = null));
}

async function boot() {
  createWindow();
  const logFile = path.join(app.getPath("userData"), "server.log");
  try {
    const port = await freePort();
    server = startServer(port, logFile);
    await waitReady(port, () => server.exited);
    const origin = `http://127.0.0.1:${port}`;
    win?.webContents.on("will-navigate", (e, url) => {
      if (!url.startsWith(origin) && /^https?:/i.test(url)) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });
    await win?.loadURL(origin);
  } catch (e) {
    if (quitting) return;
    dialog.showErrorBox("PaperPrism 启动失败 / Failed to start", `${e.message}\n\n${logFile}`);
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(boot);
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    if (server && !server.exited) server.kill();
  });
}
