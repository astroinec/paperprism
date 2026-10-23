# PaperPrism · 论文文献对比 Agent

本地优先的多论文对比工具：导入论文后生成**可溯源的对比矩阵**、**带引用的分析报告**、**基于原文的多论文问答**和**可视化图表**。界面是 Apple 风格的磨砂玻璃效果，支持中英双语和浅色/深色主题。

- 需求文档：[`docs/PRD.md`](docs/PRD.md)
- 开发文档：[`docs/DEV.md`](docs/DEV.md)

## 快速开始

需要 Node.js ≥ 20.9。

```bash
npm install
npm run dev          # 打开 http://localhost:3000
```

首次启动会自动创建内置的**离线演示模型**（`Prism Demo`）。不需要任何 API Key，也能走完整个流程：

1. **文献库**：拖入 PDF，或检索 arXiv / Semantic Scholar，或粘贴链接 / DOI / 文本
2. **对比项目**：选论文和维度模板（通用 / 实验型 / 综述型 / 临床 / 空白），也可以让 AI 推荐维度
3. **一键抽取**：每个单元格附带原文引用、页码、置信度，以及引用是否核验通过
4. **分析报告**：先规划大纲，再逐节撰写，最后校验引用；可导出 Markdown / Word
5. **问答**：先检索原文片段再回答，引用 `[P1, p.5]` 可点击跳到 PDF 对应页
6. **图表**：数值对比、评分雷达、时间线、文本相似度热力图
7. **导出**：Excel（含 Matrix / Evidence / Papers 三张表）、CSV、Markdown、BibTeX

## 配置模型（API 配置）

在左侧栏「API 配置」页添加服务商。内置以下预设：

| 类型 | 预设 |
| --- | --- |
| OpenAI 兼容 | OpenAI、DeepSeek、通义千问（百炼）、Kimi、智谱 GLM、硅基流动、OpenRouter、自定义 |
| Anthropic 原生 | Anthropic |
| Ollama 本地 | `http://localhost:11434` |

- 「获取模型列表」从远端拉取可用模型，也可以手动填写模型 ID
- 「测试连接」会发一次最小请求，显示延迟或错误信息
- 顶部栏的模型切换器可随时切换当前模型；「按任务指定模型」可以给抽取、报告、问答、维度推荐分别指定模型
- 填写每百万 Token 单价后，「设置 → 用量统计」会显示估算费用
- API Key 用 AES-256-GCM 加密后存在本地，界面只显示掩码

## 脚本

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm start            # 运行生产构建
npm run typecheck    # TypeScript 类型检查
npm test             # Vitest 单元测试
```

## 数据与环境变量

所有数据保存在 `data/` 目录：SQLite 数据库 `paperprism.db` 和 PDF 文件 `files/`。该目录已加入 `.gitignore`。

| 变量 | 说明 |
| --- | --- |
| `PAPERPRISM_DATA_DIR` | 自定义数据目录，默认 `./data` |
| `PAPERPRISM_SECRET` | 加密 API Key 的主密钥。不设置时自动生成 `data/.key`，删除该文件后已保存的 Key 将无法解密 |

## Windows 安装包

在 GitHub 上：推送代码后进入 Actions -> `build-win` -> Run workflow（或推送 `v0.1.0` 之类的 tag），下载产物 `PaperPrism-Setup-*.exe`，双击即装，无需安装 Node 或任何依赖。数据保存在 `%APPDATA%\PaperPrism\data`。
自己在 Windows 上构建：把同版本 `node.exe` 放到 `build/node.exe`，然后 `npm ci && npm run dist:win`。详见 `docs/DEV.md` §12。首次运行 SmartScreen 会提示「未知发布者」（未签名），点「更多信息 -> 仍要运行」。

## 技术栈

Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS v4 · better-sqlite3 · unpdf · MiniSearch（BM25，支持中文二元分词）· ECharts 6 · ExcelJS · docx · motion。LLM 适配层基于 `fetch` + SSE 自行实现，支持 OpenAI 兼容、Anthropic、Ollama 三类接口。

## 已知限制

- 扫描版 PDF（没有文本层）会标记为「无文本层」，一期不做 OCR
- 离线演示模型输出的是根据原文句子拼出来的示意内容，只用于体验流程
- 后续计划：OCR、向量检索、多模型交叉校验、Zotero 导入（见 `docs/DEV.md` §12）
