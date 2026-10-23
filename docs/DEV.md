# PaperPrism 开发文档（DEV）

> 对应需求：`docs/PRD.md` v1.0　日期：2026-10-23

## 1. 技术栈与版本

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript（strict） | 前后端一体，Route Handlers 作为本地 API |
| 样式 | Tailwind CSS v4 + 自定义 CSS 变量（玻璃材质 token） | `src/app/globals.css` |
| 动效 | `motion`（Framer Motion） | 弹簧动画、布局动画 |
| 数据获取 | `swr` | 客户端缓存与刷新 |
| 数据库 | `better-sqlite3`（同步 API，直接 SQL） | 单文件 `data/paperprism.db`，WAL 模式 |
| PDF | `unpdf`（服务端按页抽取文本） | 预览使用浏览器原生 PDF 查看器 `#page=N` |
| XML | `fast-xml-parser` | 解析 arXiv Atom |
| 检索 | `minisearch`（BM25）+ 自定义 CJK bigram 分词 | 问答与长文上下文选择 |
| 图表 | `echarts` 6 | 柱状、雷达、时间线、热力图 |
| 导出 | `exceljs`、`docx`、自写 CSV/Markdown/BibTeX | |
| Markdown | `react-markdown` + `remark-gfm` | 报告与问答渲染 |
| 图标 | `lucide-react` | |
| 测试 | `vitest` | 纯函数单测 |

### 1.1 与计划相比的技术调整（为降低风险）
- **LLM 适配层自研**（基于 `fetch` + SSE 解析）而非 Vercel AI SDK：AI SDK 当前 v6/v7 并行且 API 变化频繁；OpenAI Chat Completions、Anthropic Messages 协议稳定，自研约 300 行即可完全掌控流式、用量统计、错误信息，且便于实现 Mock Provider。
- **直接 SQL** 替代 Drizzle：表结构简单，少一层依赖与迁移工具。
- **轻量 i18n**（字典 + React Context）替代 next-intl：单用户本地应用无需基于路由的多语言。
- **原生 PDF 查看器**（iframe + `#page=N`）替代 react-pdf：免去 pdf.js worker 配置，主流浏览器都支持页码跳转。

## 2. 架构

```
┌──────────────────────── Browser ────────────────────────┐
│  App Shell (Background / Sidebar / TopBar / ModelSwitch)│
│  Pages: Dashboard · Library · Projects · Workspace ·    │
│         Settings · Providers                            │
│  Glass UI Kit · i18n · Theme · SWR · NDJSON stream 读取  │
└───────────────▲─────────────────────────────────────────┘
                │ fetch / NDJSON streaming
┌───────────────┴──────── Next.js Route Handlers ─────────┐
│ /api/providers  /api/papers  /api/search  /api/projects │
│ /api/reports  /api/chats  /api/export  /api/usage       │
├─────────────────────────────────────────────────────────┤
│ Agents: extract · suggestDimensions · summarize ·       │
│         report(plan→draft→review) · chat(RAG)           │
├─────────────────────────────────────────────────────────┤
│ LLM Adapter: openai-compatible │ anthropic │ ollama │ mock│
│ Sources: arXiv · Semantic Scholar · Crossref · URL      │
│ PDF (unpdf) · Retrieval (MiniSearch) · Export · Crypto  │
├─────────────────────────────────────────────────────────┤
│ SQLite (better-sqlite3)          data/files/*.pdf       │
└─────────────────────────────────────────────────────────┘
```

## 3. 目录结构

```
src/
  app/
    layout.tsx  globals.css  page.tsx            # 仪表盘
    library/page.tsx
    projects/page.tsx  projects/[id]/page.tsx    # 工作台（矩阵/报告/问答/图表）
    settings/page.tsx  settings/providers/page.tsx
    api/...                                      # 见第 5 节
  components/
    glass/        # Panel, Button, Input, Textarea, Select, Segmented, Switch, Slider, Modal, Drawer, Badge, Toast, Spinner, Empty
    layout/       # Background, Sidebar, TopBar, ModelSwitcher, AppProviders
    library/      # ImportPanel, PaperCard, PaperDrawer
    project/      # MatrixView, CellDrawer, DimensionEditor, ReportView, ChatView, InsightsView, Chart, NewProjectModal
    common/       # Markdown（含引用链接）
  lib/
    shared/       # types.ts, templates.ts, citations.ts, presets.ts, utils.ts
    client/       # api.ts, ndjson.ts, i18n.tsx, dict/{zh,en}.ts, settings.tsx
    server/
      db.ts  crypto.ts  paths.ts  ids.ts
      repo/       # providers.ts papers.ts projects.ts reports.ts chats.ts usage.ts settings.ts
      llm/        # types.ts index.ts openai.ts anthropic.ts mock.ts sse.ts json.ts
      pdf.ts      # 文本抽取、元数据推断
      sources/    # arxiv.ts s2.ts crossref.ts
      retrieval.ts  # 分块、BM25、上下文预算
      agents/     # extract.ts dimensions.ts summarize.ts report.ts chat.ts
      export/     # csv.ts markdown.ts xlsx.ts docx.ts bibtex.ts
      insights.ts # 数值解析、TF-IDF 相似度
tests/            # vitest
data/             # 运行时生成（gitignore）
```

## 4. 数据模型（SQLite）

```sql
providers(id TEXT PK, name, type TEXT /*openai|anthropic|ollama|mock*/, base_url, api_key_enc, enabled INT, created_at)
models(id TEXT PK, provider_id, model_id, label, enabled INT, price_in REAL, price_out REAL)   -- 价格：每 1M token
settings(key TEXT PK, value TEXT /*JSON*/)    -- activeModel, taskModels, temperature, maxTokens, concurrency, outputLang
papers(id TEXT PK, title, authors TEXT/*JSON*/, year INT, venue, doi, arxiv_id, abstract, url,
       source TEXT, file_path, num_pages INT, status TEXT /*ready|no_text|error*/, error, tags TEXT, citation_count INT, created_at)
pages(paper_id, page_no INT, text, PK(paper_id,page_no))
projects(id TEXT PK, name, question, template, created_at, updated_at)
project_papers(project_id, paper_id, position INT, PK(project_id,paper_id))
dimensions(id TEXT PK, project_id, name, description, type TEXT /*text|number|rating|tags*/, position INT, summary)
cells(project_id, paper_id, dimension_id, value, numeric REAL, quote, page INT, confidence, source /*stated|inferred|not_found*/,
      verified INT, status /*done|error*/, error, edited INT, model, updated_at, PK(project_id,paper_id,dimension_id))
reports(id TEXT PK, project_id, style, language, outline TEXT, content TEXT, model, created_at, updated_at)
chats(id TEXT PK, project_id, title, created_at)
messages(id TEXT PK, chat_id, role, content, sources TEXT, created_at)
usage(id INTEGER PK, provider_id, model, task, input_tokens INT, output_tokens INT, latency_ms INT, created_at)
```

## 5. API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/providers` | 列表（Key 掩码）/ 新建 |
| GET/PATCH/DELETE | `/api/providers/[id]` | |
| POST | `/api/providers/[id]/test` | 连通性测试 `{modelId?}` → `{ok, latencyMs, error?}` |
| GET | `/api/providers/[id]/remote-models` | 从远端拉取模型列表 |
| POST | `/api/providers/[id]/models` | 添加模型 `{modelIds[]}` |
| PATCH/DELETE | `/api/models/[id]` | 启用/价格/删除 |
| GET/PATCH | `/api/settings` | 服务端设置（当前模型等） |
| GET/POST | `/api/papers` | 列表 / multipart 上传 PDF |
| POST | `/api/papers/import` | `{kind:'arxiv'\|'s2'\|'url'\|'text', ...}` |
| GET/PATCH/DELETE | `/api/papers/[id]` | |
| GET | `/api/papers/[id]/file` | PDF 文件流 |
| GET | `/api/search/arxiv?q=` · `/api/search/s2?q=` | 外部检索 |
| GET/POST | `/api/projects` | |
| GET/PATCH/DELETE | `/api/projects/[id]` | GET 返回 papers + dimensions + cells |
| PUT | `/api/projects/[id]/papers` | 设置论文 |
| PUT | `/api/projects/[id]/dimensions` | 整体保存维度 |
| POST | `/api/projects/[id]/suggest-dimensions` | AI 推荐维度 |
| POST | `/api/projects/[id]/extract` | `{paperId, dimensionIds?}` → 该论文单元格 |
| PATCH | `/api/projects/[id]/cells` | 手动编辑单元格 |
| POST | `/api/projects/[id]/summaries` | 每维度一句话横向结论 |
| GET/POST | `/api/projects/[id]/reports` | 列表 / 生成（NDJSON 流） |
| GET/PATCH/DELETE | `/api/reports/[id]` | |
| GET | `/api/reports/[id]/export?format=md\|docx` | |
| GET/POST | `/api/projects/[id]/chats` | |
| GET/DELETE | `/api/chats/[id]` | |
| POST | `/api/chats/[id]/messages` | 发送提问（NDJSON 流） |
| GET | `/api/projects/[id]/insights` | 图表数据 |
| GET | `/api/projects/[id]/export?format=xlsx\|csv\|md` | 矩阵导出 |
| GET | `/api/export/bibtex?projectId=` | BibTeX |
| GET | `/api/usage` · `/api/stats` | 用量与仪表盘统计 |

### 5.1 NDJSON 流事件
```ts
type ReportEvent =
  | { type: 'step'; step: 'plan' | 'draft' | 'review'; section?: number }
  | { type: 'outline'; sections: { title: string; goal: string }[] }
  | { type: 'delta'; section: number; text: string }
  | { type: 'done'; reportId: string; warnings: string[] }
  | { type: 'error'; message: string };
type ChatEvent =
  | { type: 'sources'; sources: Source[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };
```

## 6. LLM 适配层

```ts
interface LLMRequest { system?: string; messages: {role:'user'|'assistant'; content:string}[];
  temperature?: number; maxTokens?: number; signal?: AbortSignal; task: string }
interface LLMClient {
  generate(req): Promise<{ text: string; usage: Usage }>;
  stream(req): AsyncGenerator<string, Usage>;
}
getClient(target?: {providerId, modelId}) // 无参数 → settings.taskModels[task] ?? settings.activeModel
```
- **openai**：`POST {base}/chat/completions`，`stream: true` + `stream_options.include_usage`（若 400 则去掉重试）；列表 `GET {base}/models`。
- **anthropic**：`POST {base}/v1/messages`，头 `x-api-key`、`anthropic-version: 2023-06-01`；事件 `content_block_delta / message_start / message_delta`；列表 `GET {base}/v1/models`。
- **ollama**：对话走 `{base}/v1/chat/completions`；列表 `GET {base}/api/tags`。
- **mock**：根据 prompt 中的标记（`<<TASK:extract>>` 等）返回确定性的演示 JSON / Markdown，并模拟流式延迟。
- 用量缺失时按 `字符数/4` 估算；每次调用写入 `usage` 表。
- `json.ts`：剥离 ```json 围栏 → 截取首个 `{`/`[` 至末尾匹配 → `JSON.parse` → zod 校验；失败则带错误信息让模型修复一次。

## 7. Agent 设计

### 7.1 抽取（extract）
1. 构建上下文：论文按页拼接 `[[Page n]]`；超过预算（默认 60k 字符）时保留前 2 页 + 按维度名/说明做 BM25 选出的高相关分块（按页序）。
2. 一次请求抽取该论文全部（或指定）维度，维度 >12 时分批。
3. 输出 schema：
```json
{"cells":[{"dimension_id":"...","value":"...","numeric":null,"quote":"原文逐字引用","page":3,
  "confidence":"high|medium|low","source":"stated|inferred|not_found"}]}
```
4. **引用核验**：将 quote 归一化（去空白/连字符/大小写）后在各页文本中查找，命中则 `verified=1` 并修正 `page`。
5. number 类型从 value 解析数值兜底；rating 类型限定 1–5。

### 7.2 推荐维度 / 维度结论
- 推荐：输入各论文标题 + 摘要 + 研究问题 → `{dimensions:[{name,description,type}]}`。
- 结论：输入矩阵某维度一列 → 一句话横向比较，存 `dimensions.summary`。

### 7.3 报告（Plan → Draft → Review）
- Plan：矩阵 Markdown 表（论文编号 P1..Pn）+ 摘要 + 风格 → 大纲 JSON。
- Draft：逐节流式写作，要求引用格式 `[P1, p.5]` 或 `[P2]`。
- Review：正则校验引用编号范围，越界的引用列入 warnings。

### 7.4 问答（RAG）
- 项目论文按页 → ~1200 字符分块（重叠 150）→ MiniSearch BM25（CJK bigram）→ Top 8。
- Prompt 中以 `[P{i}, p.{page}]` 标注片段，回答要求同格式引用；携带最近 6 轮历史。

## 8. 前端设计系统实现

- CSS 变量：`--glass-alpha`（由玻璃强度滑杆 0–1 映射）、`--glass-blur`、`--glass-sat`、`--accent`。
- `.glass` / `.glass-thin` / `.glass-thick`：`background: rgb(var(--glass-tint) / alpha)` + `backdrop-filter: blur() saturate()` + 1px 半透明描边 + `::before` 顶部高光渐变 + 大投影。
- `html[data-reduce-transparency]`：去 blur，96% 实色；`@supports not (backdrop-filter)` 同样降级。
- `Background`：4 个绝对定位光斑 + CSS keyframes 漂移 + 噪点 SVG。
- Spotlight：卡片 `onPointerMove` 设置 `--mx/--my`，`radial-gradient` 跟随高光。
- 运行态：`.running-border` 使用 `conic-gradient` + `@property --angle` 旋转。
- 主题：`html.dark` 类；`system` 时监听 `prefers-color-scheme`。客户端设置存 `localStorage`，首屏由 `BootScript`（SSR 输出可执行脚本、客户端渲染为 `text/plain` 以避开 React 19 内联脚本警告）防闪烁。
- Portal（Modal / Drawer / Toast）统一用 `useMounted()`（`useSyncExternalStore`）门控，避免 SSR/水合不一致。

## 9. 错误处理
- Route Handler 统一 `handle()` 包装：捕获异常返回 `{error}` + 状态码。
- LLM 错误透传上游状态码与消息（截断 500 字符），前端 Toast 显示。
- 抽取单论文失败 → 该论文所有目标单元格写 `status=error`，可重试。
- 未产生任何输出的失败请求（如地址错误、401）不计入用量统计。

## 10. 测试与验证
- Vitest（`tests/`，46 个用例）：`bibtex` 转义与 cite key、`citations` 解析/链接化/越界检测、`extractJson` 修复、`<think>` 流式过滤、`retrieval` 分块/CJK 分词/BM25 排序/引文定位、`crypto` 往返与防篡改、arXiv Atom 解析与 ID 识别、`parseNumber`（排除 `Top-1`、`GPT-4`、`ImageNet-21K` 等与名称粘连的数字）。
- `npm run typecheck`、`npm run build`。
- 端到端（已执行）：Mock Provider 跑通 导入→建项目→推荐维度→矩阵抽取→维度结论→报告（NDJSON 流）→问答（RAG）→图表→导出 xlsx/csv/md/docx/bib；真实 arXiv / Semantic Scholar 检索与 PDF 下载解析；Provider 增删、测试连接（含真实 401 错误回显）、按任务模型、删除时清理设置；浏览器逐页检查无运行时/水合错误，深色与英文切换生效。

## 11. 运行
```bash
npm install
npm run dev      # http://localhost:3000
npm test
```
环境变量（可选）：`PAPERPRISM_DATA_DIR`（数据目录）、`PAPERPRISM_SECRET`（加密主密钥，否则自动生成 `data/.key`）。

## 12. Windows 安装包
Electron 外壳 + Next `standalone` + 随包 `node.exe`（`electron/main.cjs` 在本机 127.0.0.1 随机端口启动服务，窗口加载该地址）。
- 数据目录：`%APPDATA%\PaperPrism\data`（通过 `PAPERPRISM_DATA_DIR` 注入），升级与卸载均保留；服务日志 `%APPDATA%\PaperPrism\server.log`。
- 构建：`npm run dist:win`（`next build` -> `scripts/prepare-standalone.mjs` -> `electron-builder`），产物 `release/PaperPrism-Setup-<version>.exe`。需先把 `node.exe`（与 CI 相同的 Node 22）放到 `build/node.exe`。
- `prepare-standalone.mjs` 做两件事：把 Turbopack 生成的 `.next/node_modules/<pkg>-<hash>` 绝对软链替换为真实拷贝；确保 `better-sqlite3/prebuilds/win32-x64.node` 存在。
- CI：`.github/workflows/build-win.yml`（windows-latest；手动触发或推 `v*` tag）。含类型检查、测试、冒烟启动与静默安装校验，产物上传 artifact，tag 时附到 Release。
- 本地调试壳：`PP_NODE=$(which node) npm run electron:dev`。
- 未签名，首次运行 SmartScreen 会提示「未知发布者」。

## 13. 后续规划
- OCR（tesseract.js）、Embedding 混合检索、多模型交叉抽取 + Judge、Zotero 导入。
