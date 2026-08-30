# 戏匠：AI 漫剧 / 短剧剧本工作台

戏匠是一个本地优先的 AI 剧本生产工作台。它把创意、原始小说或已有剧本，整理成可继续编辑、评估、改写和制作的分集剧本，并进一步提取场景、人物、道具资产，生成可用于图片模型的资产板提示词。

## 为什么创建这个项目

短剧和漫剧创作往往需要在多个工具之间反复复制内容：创意在一个地方，剧本在另一个地方，角色设定和图片提示词又分散在笔记中。这样容易出现以下问题：

- 剧本改写后，前后分集的人物和道具设定不一致；
- 第一集生成的资产无法在后续分集继续复用；
- AI 生成失败时，用户只能看到“生成失败”，很难定位原因；
- API Key、剧本正文和版本历史缺少清晰的本地保存边界。

戏匠尝试把这些环节放进一个可追溯的本地工作流中：每个分集是独立版本，生成上下文会被保存；模型分析资产时会读取全部已保存分集和现有资产库；模型失败时保留已有结果，不会清空历史数据。

## 当前功能

- 一句话创意、小说章节、故事大纲或已有剧本输入；
- 首集自动生成故事大纲，再基于大纲生成第一集剧本；
- 分集剧本生成、前集引用和版本保存；
- 剧本诊断评分与可追溯改写；
- 从全部已保存分集提取场景、人物、道具；
- 使用大模型判断哪些资产值得制作，并合并历史资产；
- 为每项资产生成资产板图片提示词，包含构图、材质、视图和负面提示词；
- Ollama 与 OpenAI-compatible API；
- SQLite 本地持久化；
- Windows Credential Manager 保存 API Key（不可用时降级为当前会话内存保存）；
- Markdown / JSON 导出与敏感信息脱敏。

## 技术栈

- 前端：React 19、TypeScript、Vite、React Router、Zod、Zustand
- 桌面端：Tauri 2、Rust、SQLite、SQLx
- AI 接口：Ollama、本地或远程 OpenAI-compatible API
- 测试：Vitest、Playwright
- 构建：Vite、Tauri CLI、Cargo

## 环境要求

- Node.js 20 或更高版本（建议使用 LTS）
- npm 10 或更高版本
- Rust stable、`rustc`、`cargo`
- Windows 桌面开发需要 Visual Studio C++ Build Tools 和 WebView2 Runtime
- 可选：Ollama，默认地址为 `http://127.0.0.1:11434`

检查环境：

```powershell
node --version
npm --version
rustc --version
cargo --version
```

## 从 GitHub 获取并启动

```powershell
git clone <你的 GitHub 仓库地址>
cd ai-drama-workbench
npm install
```

如果 PowerShell 提示禁止运行 `npm.ps1`，请将命令中的 `npm` 改为 `npm.cmd`，例如 `npm.cmd install`、`npm.cmd run tauri:dev`；`npx` 同理使用 `npx.cmd`。

### 浏览器开发模式

```powershell
npm run dev
```

打开 <http://localhost:1420/>。

### Tauri 桌面开发模式

```powershell
npm run tauri:dev
```

Windows 下也可以双击项目根目录的 `start-tauri-dev.cmd`。首次启动会编译 Rust 依赖，可能需要几分钟。

## 配置 AI 模型

启动应用后打开“模型设置”，填写供应商、Base URL、模型名称和 API Key。

### Ollama

```powershell
ollama pull qwen2.5:7b
ollama serve
```

然后在应用中选择 Ollama，并使用 `http://127.0.0.1:11434`。

### OpenAI-compatible API

填写服务商提供的 Base URL、模型名称和 API Key。API Key 不会写入剧本、导出文件或生成日志。仓库中只应提交 `example_env.txt` 这类示例文件，不要提交真实密钥。

## 资产提取流程

1. 先生成并保存至少一集剧本；
2. 点击“提取资产”；
3. 应用会把全部已保存分集和已有资产库发送给当前模型；
4. 模型判断值得制作的场景、人物和道具；
5. 应用合并资产、生成资产板提示词并保存到项目；
6. 后续分集再次提取时，之前的资产仍会保留。

## 常用开发命令

```powershell
npm run format:check
npm run typecheck
npm run build
```

## 构建 Windows 可执行文件

构建前端和 Tauri 桌面程序：

```powershell
npx.cmd tauri build
```

发布构建产物位于 `src-tauri/target/release/`。只生成可执行文件、不生成安装包时：

```powershell
npx.cmd tauri build --no-bundle
```

## 上传 GitHub 前检查

确认以下内容没有被提交：

- 真实 API Key、Bearer Token 或其他密钥；
- 本地数据库和个人剧本；
- `dist/`、`src-tauri/target/` 等构建产物（除非你明确要发布它们）；
- 含个人信息的截图、测试输出和临时文件。

可以运行密钥扫描：

```powershell
npm run scan:secrets
```

然后再执行：

```powershell
git status
git add .
git commit -m "docs: add project README"
git push origin main
```

## 项目状态

项目目前适合本地开发和个人创作使用。模型输出质量取决于所配置的模型和上下文长度；生产环境使用前，建议检查剧本内容、资产判断和图片提示词，不要把未经审核的模型输出直接用于商业发布。
