# AI 漫剧剧本工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个本地优先的 AI 漫剧剧本工作台，完成“小说/创意输入 -> 分集剧本 -> 诊断评分 -> 可控改写 -> 资产与资产板提示词 -> Seedance2 镜头组 -> 导出”的可验收闭环。

**Architecture:** 使用 Tauri + React/TypeScript 构建桌面应用，Rust 侧负责本地文件、SQLite、系统安全存储和模型请求代理，前端只通过类型化应用服务访问领域能力。所有 AI 任务先产出版本化 JSON Schema，再由渲染器生成 Markdown；项目原稿、故事圣经、版本、评分、资产和镜头组均通过稳定 ID 建立可追溯关系。模型供应商通过统一 `ModelAdapter` 接口隔离，支持 Ollama 和 OpenAI-compatible API。

**Tech Stack:** Tauri 2、React、TypeScript strict、Vite、SQLite、Rust `sqlx`、Zod/JSON Schema、Vitest、Playwright、MSW、`@tauri-apps/plugin-store` 或操作系统 Keychain、Markdown AST parser。

---

## 1. 实施范围和硬性规则

本计划以 `E:/戏匠/ai-drama-product-standards.md` 为唯一验收基准，必须覆盖其中的 P0 项和 Skill 对齐章节。

- 剧本改编遵守 `【本次改编】`、`【剧本信息】`、`【主要人设】`、`【故事梗概】`、分集、改编处理、质量自检结构。
- 原文对白、明确内心独白和选作 VO/OS 的原文必须建立声音台账并逐字保护。
- 原文未提供的人物、道具、事件、关系、地点和镜头事实不得静默新增。
- 资产固定分为人物、场景、道具、UI，名称统一为 `@人物/@场景/@道具/@UI`。
- 资产板每个条目都必须自包含 `用途`、`风格基线`、`拆分细节`、可选 `色卡约束`、`版式要求`、`提示词`、`避免`。
- Seedance2 镜头组约 10 秒，包含人物、场景、道具/UI、对白锁定、分镜承接、风格总纲、3-4 个 timed shots、四宫格和视频提示词。
- 默认禁止字幕、BGM 描述、面部变形、闪烁重影和不稳定身份。

## 2. 目标文件结构

### 2.1 根目录配置

- `package.json`：前端脚本、依赖和质量门禁命令。
- `vite.config.ts`：Vite、测试和路径别名配置。
- `tsconfig.json`、`tsconfig.node.json`：严格 TypeScript 配置。
- `playwright.config.ts`：桌面 WebView/开发模式 E2E 配置。
- `src-tauri/tauri.conf.json`：权限、窗口、打包和资源配置。
- `README.md`：安装、Ollama/API 配置、开发和验收命令。

### 2.2 前端领域和应用层

- `src/domain/models.ts`：Project、SourceDocument、ScreenplayVersion、StoryBible、ScoreReport、Asset、BoardPrompt、ShotGroup 等类型。
- `src/domain/schemas/*.ts`：每个 AI 产物的 Zod/JSON Schema 和版本号。
- `src/domain/rules/*.ts`：时长、锁定事实、命名、格式、连续性和默认负面约束等纯规则。
- `src/application/model/model-adapter.ts`：统一模型接口、请求参数、流式事件和错误类型。
- `src/application/services/*.ts`：导入、解析、改编、评分、改写、资产、资产板、镜头组和导出编排。
- `src/infrastructure/*.ts`：Tauri command 调用、仓储、日志脱敏、文件选择和导出适配器。

### 2.3 前端界面

- `src/app/App.tsx`：应用壳和路由。
- `src/app/store/*.ts`：项目、任务、版本和设置状态。
- `src/features/project/*`：项目列表和项目生命周期。
- `src/features/source/*`：一句话创意、文本粘贴、`.txt/.md` 导入和解析待确认项。
- `src/features/screenplay/*`：剧本编辑、评分、引用定位、改写和版本差异。
- `src/features/assets/*`：资产清单、故事圣经和锁定事实。
- `src/features/boards/*`：资产板提示词编辑和复制。
- `src/features/shots/*`：Seedance2 镜头组、四宫格和视频提示词。
- `src/features/settings/*`：Ollama/API 配置、连接测试和安全存储。
- `src/components/*`：通用编辑器、任务进度、错误边界、差异视图和导出控件。

### 2.4 Rust、本地数据和测试

- `src-tauri/src/main.rs`：Tauri 入口、command 注册和权限初始化。
- `src-tauri/src/commands/*.rs`：项目、文件、模型代理、密钥存储和导出命令。
- `src-tauri/src/db/*.rs`：SQLite 连接、迁移、事务和仓储。
- `src-tauri/migrations/*.sql`：版本化数据库迁移。
- `tests/fixtures/*.md`：至少 20 份脱敏剧本和固定输出基准。
- `tests/unit/*.test.ts`：纯规则和 Schema 测试。
- `tests/integration/*.test.ts`：仓储、适配器和跨服务测试。
- `tests/e2e/*.spec.ts`：主流程、异常、离线和安全场景。

## 3. 交付顺序和分支门禁

采用可运行纵向切片，每个切片必须同时包含界面入口、领域逻辑、持久化、错误状态和自动化测试：

1. 本地项目、原稿、版本和导出基础能力。
2. Ollama/API 适配和模型任务状态。
3. 输入解析、声音台账和分集剧本改编。
4. 评分、引用定位、可控改写和锁定事实。
5. 资产提取、资产板提示词和命名连续性。
6. Seedance2 镜头组、四宫格对齐和视频提示词。
7. 故障、安全、长文本、离线和发布验收。

每个任务完成后执行 `npm run format:check; npm run lint; npm run typecheck; npm test -- --run`。在仓库初始化后，每个任务形成一个可回滚提交，提交信息使用 `feat: ...`、`fix: ...` 或 `test: ...`。

## 4. 任务清单

### Task 1: 创建桌面应用骨架和质量命令

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/app/App.tsx`
- Create: `src/app/styles.css`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `README.md`
- Test: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: 初始化 Tauri + React TypeScript 工程**

运行：

```powershell
npm create vite@latest . -- --template react-ts --force
npm install
npm install zod zustand react-router-dom diff unified remark-parse
npm install -D @tauri-apps/cli vitest @vitest/coverage-v8 playwright @playwright/test eslint prettier typescript
npm run build
```

预期：Vite 生产构建退出码为 0，生成 `dist/index.html`。

- [ ] **Step 2: 配置严格类型和质量脚本**

在 `package.json` 添加以下脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

`tsconfig.json` 必须开启 `strict`、`noUncheckedIndexedAccess`、`noImplicitOverride` 和 `noFallthroughCasesInSwitch`。

- [ ] **Step 3: 建立 smoke E2E 测试**

在 `tests/e2e/smoke.spec.ts` 写入：

```ts
import { test, expect } from '@playwright/test';

test('opens the local project workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI 漫剧剧本工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible();
});
```

运行 `npm run test:e2e -- tests/e2e/smoke.spec.ts`，预期 1 个用例通过。

### Task 2: 定义领域模型、JSON Schema 和版本策略

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/schemas/project.schema.ts`
- Create: `src/domain/schemas/screenplay.schema.ts`
- Create: `src/domain/schemas/score.schema.ts`
- Create: `src/domain/schemas/asset.schema.ts`
- Create: `src/domain/schemas/shot-group.schema.ts`
- Create: `src/domain/schemas/index.ts`
- Test: `tests/unit/schema-validation.test.ts`

- [ ] **Step 1: 写出稳定 ID 和核心实体类型**

至少定义以下接口：

```ts
export type EntityId = string;
export type AssetKind = 'character' | 'scene' | 'prop' | 'ui';
export type ModelProvider = 'ollama' | 'openai-compatible';

export interface Project {
  id: EntityId;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  sourceDocumentIds: EntityId[];
  activeVersionId: EntityId | null;
  storyBibleId: EntityId | null;
}

export interface LockedFact {
  id: EntityId;
  category: 'person' | 'relationship' | 'world' | 'timeline' | 'plot';
  value: string;
  sourceLocation: string;
  locked: boolean;
}

export interface GenerationRecord {
  id: EntityId;
  provider: ModelProvider;
  modelName: string;
  promptVersion: string;
  inputVersionId: EntityId;
  parameters: Record<string, number | string | boolean>;
  createdAt: string;
}
```

- [ ] **Step 2: 为四类产物定义可校验 Schema**

`screenplay.schema.ts` 必须校验元数据、场次标题、角色列表、动作、对白、VO/OS、改编处理和质量自检；`asset.schema.ts` 必须校验四种 `AssetKind` 和 `@` 名称；`shot-group.schema.ts` 必须校验 10 秒时间段、shot ID、四宫格和视频提示词字段。

- [ ] **Step 3: 写失败测试并执行 Schema 校验**

在 `tests/unit/schema-validation.test.ts` 覆盖：缺少场次、无 speaker 的对白、非法资产名前缀、四宫格 shot ID 不存在、时间段超过 10 秒。运行 `npm test -- --run tests/unit/schema-validation.test.ts`，预期非法对象全部失败、合法 fixture 全部通过。

### Task 3: 实现 SQLite 持久化和项目生命周期

**Files:**
- Create: `src-tauri/migrations/001_initial.sql`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/models.rs`
- Create: `src-tauri/src/db/repository.rs`
- Create: `src-tauri/src/commands/projects.rs`
- Create: `src/infrastructure/project-repository.ts`
- Create: `src/application/services/project-service.ts`
- Test: `tests/integration/project-persistence.test.ts`

- [ ] **Step 1: 创建数据库表和迁移**

`001_initial.sql` 创建 `projects`、`source_documents`、`screenplay_versions`、`story_bibles`、`generation_records`、`scores`、`assets`、`board_prompts`、`shot_groups`、`export_records` 表；每表包含稳定 ID、`created_at`、`updated_at` 和 `schema_version`。原稿正文单独存储，版本通过 `source_version_id` 和 `parent_version_id` 追溯。

- [ ] **Step 2: 实现事务仓储和 Tauri commands**

提供 `createProject`、`renameProject`、`listProjects`、`loadProjectGraph`、`softDeleteProject`、`restoreProject` 和 `saveVersion`。项目删除必须是软删除；永久清理不放入 V1 command。

- [ ] **Step 3: 写重启恢复集成测试**

测试创建项目，写入原稿、两个剧本版本、评分、资产、镜头组和导出记录，关闭数据库连接后重新打开并比对完整对象图。运行 `npm test -- --run tests/integration/project-persistence.test.ts`，预期对象 ID、正文和关系全部一致。

### Task 4: 实现模型适配层、任务取消和错误分类

**Files:**
- Create: `src/application/model/model-adapter.ts`
- Create: `src/application/model/model-errors.ts`
- Create: `src/infrastructure/model/ollama-adapter.ts`
- Create: `src/infrastructure/model/openai-compatible-adapter.ts`
- Create: `src/application/model/generation-runner.ts`
- Create: `src-tauri/src/commands/model.rs`
- Test: `tests/unit/model-errors.test.ts`
- Test: `tests/integration/model-adapters.test.ts`

- [ ] **Step 1: 固定统一适配器接口**

```ts
export interface ModelAdapter {
  testConnection(): Promise<ModelConnectionResult>;
  listModels(): Promise<readonly string[]>;
  generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<GenerationEvent>;
}
```

`GenerationRequest` 必须包含 `taskType`、分层 prompt、JSON Schema、温度、最大输出长度、超时和重试次数；`GenerationEvent` 至少包含 `started`、`delta`、`validated`、`completed`、`failed`。

- [ ] **Step 2: 实现 Ollama 和 OpenAI-compatible 请求映射**

Ollama 默认读取 `http://127.0.0.1:11434`，支持服务探测和模型列表；自定义 API 支持 base URL、模型名、Bearer API Key、连接测试和流式响应。任何响应先进入 Schema 校验，不允许 UI 直接消费未校验 JSON。

- [ ] **Step 3: 映射可操作错误并测试取消**

定义 `ModelErrorCode`：`network`、`service-not-running`、`auth`、`quota`、`context-limit`、`timeout`、`cancelled`、`schema-invalid`、`server`。测试每类错误都保留当前输入版本，并允许重试或切换适配器；运行 `npm test -- --run tests/integration/model-adapters.test.ts`，预期错误码和取消事件准确。

### Task 5: 实现源材料导入、编码处理和结构化解析

**Files:**
- Create: `src/application/services/source-ingestion-service.ts`
- Create: `src/application/services/screenplay-parser.ts`
- Create: `src/application/services/source-voice-ledger.ts`
- Create: `src/domain/rules/source-protection.ts`
- Create: `src/infrastructure/file-importer.ts`
- Test: `tests/unit/source-protection.test.ts`
- Test: `tests/integration/source-ingestion.test.ts`
- Create: `tests/fixtures/source-dialogue.md`

- [ ] **Step 1: 实现 `.txt/.md` 导入和 UTF-8 校验**

限制扩展名为 `.txt`、`.md`，文件超过 10 MB 时拒绝导入并提示大小；优先 UTF-8，检测到其他编码时要求用户确认，不得静默替换字符。保存原始正文 hash 和字数。

- [ ] **Step 2: 实现剧本 Markdown 解析器**

识别 `【本次改编】`、`【剧本信息】`、`【主要人设】`、`【故事梗概】`、`## 第X集`、`### X-1`、`**场：...**`、`**人：...**`、动作、对白、VO/OS、`【一卡】/【二卡】`。无法确定的节点保存为 `needsReview: true` 并定位原文行号。

- [ ] **Step 3: 建立原文声音台账和保护规则**

`SourceVoiceLedgerEntry` 记录原文文本、顺序、来源位置、候选 speaker、类型 `dialogue|inner-thought|vo|os` 和是否允许拆分。实现 `compareProtectedText(before, after)`：允许连续片段拆分，不允许删除、改写、净化、合并或改变顺序。

- [ ] **Step 4: 执行导入集成测试**

用 `tests/fixtures/source-dialogue.md` 验证中文回读、对白逐字台账、未知场次待确认标记和原文 hash。运行 `npm test -- --run tests/integration/source-ingestion.test.ts`，预期原文正文完全一致。

### Task 6: 实现小说转分集剧本编排器

**Files:**
- Create: `src/application/prompts/prompt-layers.ts`
- Create: `src/application/prompts/screenplay-prompts.ts`
- Create: `src/application/services/screenplay-adaptation-service.ts`
- Create: `src/domain/rules/screenplay-format-rules.ts`
- Create: `src/domain/rules/no-invention-rules.ts`
- Create: `src/application/renderers/screenplay-markdown-renderer.ts`
- Test: `tests/unit/screenplay-format-rules.test.ts`
- Test: `tests/integration/screenplay-adaptation.test.ts`

- [ ] **Step 1: 固定五层 Prompt 合并顺序**

顺序固定为：内部策略 -> 故事圣经 -> 任务指令 -> 用户提示词 -> 输出 Schema。每层保存 `promptVersion`；用户提示词只能影响任务目标和风格，不能覆盖原文保护、安全和锁定事实规则。

- [ ] **Step 2: 实现分集改编任务**

输入支持一句话创意、小说章节、故事大纲和用户模板；参数包括题材、受众、总集数、单集时长、分集依据和风格。指定单集时只生成该集。生成提示要求 2-4 个场次、独立冲突、一次反转、悬念点和集尾钩子。

- [ ] **Step 3: 实现格式、来源和可拍摄性校验**

校验元数据块、固定章节顺序、场次头、人物列表、明确主体动作、对白情绪标签、VO1/VO2/VO3/OS、`△`、`【画面】`、`【音效】` 和改编处理/质量自检。校验失败时最多进行 2 次结构修复，仍失败则保留原输入并显示具体字段错误。

- [ ] **Step 4: 编写改编集成测试**

使用固定小说 fixture 运行 mock model，断言生成结果没有来源外人物/事件，受保护台词逐字保留，指定集数正确，集尾存在钩子且 Markdown 可回读。运行 `npm test -- --run tests/integration/screenplay-adaptation.test.ts`，预期全部通过。

### Task 7: 实现目标导向评分和引用定位

**Files:**
- Create: `src/domain/scoring/score-dimensions.ts`
- Create: `src/domain/scoring/score-calculator.ts`
- Create: `src/application/services/screenplay-scoring-service.ts`
- Create: `src/application/renderers/score-report-renderer.ts`
- Test: `tests/unit/score-calculator.test.ts`
- Test: `tests/integration/screenplay-scoring.test.ts`

- [ ] **Step 1: 定义八个评分维度和权重配置**

固定维度为钩子、冲突、人物动机、节奏、反转、对白、画面化能力、连续性；每个目标类型保存权重总和 1.0。评分结果必须包含 `score`、`weight`、`reason`、`evidence`、`suggestion` 和 `targetProfile`。

- [ ] **Step 2: 实现段落引用定位**

每条 evidence 使用原稿 `sourceDocumentId`、版本 ID、起止行号和原文片段 hash，点击报告可定位编辑器段落。引用不存在或 hash 不匹配时报告为过期，不得展示错误引用。

- [ ] **Step 3: 测试评分解释和复现记录**

固定 mock 输出验证八维齐全、权重正确、引用可定位、模型名和 prompt 版本已落库。运行 `npm test -- --run tests/integration/screenplay-scoring.test.ts`，预期报告可渲染且没有无来源建议。

### Task 8: 实现可控改写、锁定事实和版本差异

**Files:**
- Create: `src/application/services/screenplay-rewrite-service.ts`
- Create: `src/domain/rules/locked-facts.ts`
- Create: `src/domain/versioning/version-diff.ts`
- Create: `src/application/renderers/diff-renderer.tsx`
- Create: `src/features/screenplay/RewritePanel.tsx`
- Test: `tests/unit/locked-facts.test.ts`
- Test: `tests/integration/rewrite-versioning.test.ts`

- [ ] **Step 1: 实现范围选择和改写请求**

支持全文、单集、场次和段落四级范围；请求携带源版本 ID、故事圣经、锁定事实、评分问题、用户提示词和内部策略。生成中显示进度和取消按钮。

- [ ] **Step 2: 实现事实保护和重大变更报告**

改写完成后比较锁定事实、人物关系、世界观和核心剧情；任何变化都进入 `ChangeNotice`，包含前值、新值、来源位置、严重性和用户确认状态。未确认的重大变更不得覆盖当前版本。

- [ ] **Step 3: 每次改写创建独立版本**

保存新 `screenplay_version`，记录父版本、生成记录和范围；差异视图支持恢复旧版本但不删除历史。运行 `npm test -- --run tests/integration/rewrite-versioning.test.ts`，预期锁定事实违规时新版本进入待确认状态，恢复后正文与原版本一致。

### Task 9: 实现故事圣经和四类资产提取

**Files:**
- Create: `src/application/services/story-bible-service.ts`
- Create: `src/application/services/asset-extraction-service.ts`
- Create: `src/domain/rules/asset-naming.ts`
- Create: `src/features/assets/AssetTable.tsx`
- Create: `src/features/assets/StoryBiblePanel.tsx`
- Test: `tests/unit/asset-naming.test.ts`
- Test: `tests/integration/asset-extraction.test.ts`

- [ ] **Step 1: 从确认剧本提取故事圣经**

提取人物、场景、道具、UI、时间线和剧情事实，并记录首次出现的集/场/镜头。只有用户确认的剧本版本才能创建生产资产基线。

- [ ] **Step 2: 强制 `@` 命名和引用完整性**

实现 `validateAssetName(kind, name)` 和 `findDanglingAssetReferences(document)`；分别要求 `@人物名`、`@场景名`、`@道具名`、`@UI名`。重复出现在镜头中的道具/UI 若没有资产条目，阻止镜头组生成并显示来源位置。

- [ ] **Step 3: 实现资产编辑、合并、删除和锁定**

UI 支持四类筛选、来源定位、合并别名、软删除和锁定；资产变化产生新故事圣经版本并标记下游资产板/镜头组需要重新生成。运行 `npm test -- --run tests/integration/asset-extraction.test.ts`，预期四类资产和引用交叉检查通过。

### Task 10: 实现资产板提示词生成

**Files:**
- Create: `src/application/services/board-prompt-service.ts`
- Create: `src/domain/rules/board-prompt-rules.ts`
- Create: `src/application/renderers/board-prompt-markdown-renderer.ts`
- Create: `src/features/boards/BoardPromptEditor.tsx`
- Test: `tests/unit/board-prompt-rules.test.ts`
- Test: `tests/integration/board-prompt-generation.test.ts`

- [ ] **Step 1: 为每个资产生成自包含七字段**

每个条目必须包含 `用途`、`风格基线`、`拆分细节`、适用时 `色卡约束`、`版式要求`、`提示词`、`避免`；单独复制条目即可提交到图像模型，不依赖全局说明。

- [ ] **Step 2: 实现四种板式规则**

角色板包含英雄图、正/侧/背、表情、服装层、材质、配饰和固定道具；场景板包含主视图、布局、多角度、氛围、路线/机位和色卡；道具板包含三视图及开合/启用状态；UI 板包含组件网格、可读中文和无随机符号。默认设置 16:9、2K、中文标签。

- [ ] **Step 3: 支持本地 PNG 参考记录**

记录参考文件绝对路径、尺寸、hash 和采用的板式语言；生成结果必须明确继承参考布局，不将参考图内容上传到未授权的模型。运行 `npm test -- --run tests/integration/board-prompt-generation.test.ts`，预期字段完整且格式符合板式规则。

### Task 11: 实现 Seedance2 10 秒镜头组和四宫格对齐

**Files:**
- Create: `src/application/services/shot-group-service.ts`
- Create: `src/domain/rules/shot-group-rules.ts`
- Create: `src/application/renderers/shot-group-markdown-renderer.ts`
- Create: `src/features/shots/ShotGroupEditor.tsx`
- Test: `tests/unit/shot-group-rules.test.ts`
- Test: `tests/integration/shot-group-generation.test.ts`

- [ ] **Step 1: 实现固定组结构**

按 `人物信息`、`场景信息`、`道具与UI信息`、`对话锁定`、`分镜承接`、`风格总纲`、3-4 个 timed shots、四宫格、视频提示词顺序生成 Markdown 和 JSON。

- [ ] **Step 2: 实现 timed shots 和承接逻辑**

每个镜头保存时间范围、shot ID、转场、镜头/运动、主体动作、音效和旁白/对白；整组时间范围为 0-10 秒，组间保存前一镜头末尾画面、本组开场画面、承接逻辑和剪辑意图。

- [ ] **Step 3: 实现四宫格和视频提示词交叉校验**

四宫格必须复用同一 shot ID、场景名、镜头规格和核心动作，并包含画面描述、图片提示词和一行色调脚本。视频提示词必须引用已注册 `@` 资产，不得添加字幕或 BGM 描述；默认附带面部稳定、无闪烁重影和平稳镜头约束。

- [ ] **Step 4: 测试 10 秒组和命名断链**

运行 `npm test -- --run tests/integration/shot-group-generation.test.ts`，预期非法时间段、缺少字段、四宫格 ID 不一致和未注册资产均失败；合法 fixture 的四宫格/视频提示词对齐通过。

### Task 12: 构建创作工作台 UI 和任务状态

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/store/project-store.ts`
- Create: `src/app/store/generation-store.ts`
- Create: `src/components/GenerationProgress.tsx`
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/features/source/SourceInputPage.tsx`
- Create: `src/features/screenplay/ScreenplayWorkspace.tsx`
- Create: `src/features/assets/AssetsWorkspace.tsx`
- Create: `src/features/boards/BoardsWorkspace.tsx`
- Create: `src/features/shots/ShotsWorkspace.tsx`
- Create: `src/features/settings/ModelSettingsPage.tsx`
- Test: `tests/e2e/core-workflow.spec.ts`

- [ ] **Step 1: 实现项目导航和工作区状态**

页面顺序为项目 -> 输入/解析 -> 剧本/评分/改写 -> 故事圣经/资产 -> 资产板 -> 镜头组/四宫格 -> 导出。侧栏显示当前版本和待确认项，所有生成任务显示进行中、取消、成功和失败状态。

- [ ] **Step 2: 实现剧本编辑器和引用定位**

编辑器显示原稿/当前版本，评分引用可点击定位；差异视图支持接受单项改写、恢复版本和查看重大变更。锁定事实以只读标记显示，解除锁定需要二次确认。

- [ ] **Step 3: 实现模型设置页面**

提供 Ollama 服务探测、模型列表、自定义 API 地址/模型名/API Key、连接测试、超时/温度/最大输出长度设置。API Key 只显示掩码，不放入项目导出。

- [ ] **Step 4: 编写核心 E2E**

用 mock adapter 跑通：新建项目 -> 粘贴一句话创意 -> 生成分集剧本 -> 查看评分引用 -> 按单集改写 -> 锁定故事圣经 -> 提取资产 -> 生成资产板 -> 生成 Seedance2 组 -> 导出 Markdown/JSON。运行 `npm run test:e2e -- tests/e2e/core-workflow.spec.ts`，预期主链路完成且项目重新打开数据不丢失。

### Task 13: 实现安全存储、离线能力和故障恢复

**Files:**
- Create: `src-tauri/src/commands/secrets.rs`
- Create: `src/infrastructure/secret-store.ts`
- Create: `src/infrastructure/redacted-logger.ts`
- Create: `src/application/task/task-manager.ts`
- Create: `src/domain/rules/export-security.ts`
- Test: `tests/integration/security-redaction.test.ts`
- Test: `tests/e2e/failure-recovery.spec.ts`

- [ ] **Step 1: 将 API Key 放入系统安全存储**

使用操作系统 Keychain/Credential Manager 保存 secret，项目数据库只保存 secret 引用 ID。日志、错误、生成记录和导出渲染器统一调用 `redactSecrets()`，并对常见 Bearer/API Key 形式做扫描。

- [ ] **Step 2: 实现任务取消、超时和失败保留**

所有模型任务由 `TaskManager` 管理 AbortController、超时、重试上限 2 次和当前输入版本；失败时不覆盖编辑器、不创建成功版本，显示错误码和重试/切换模型操作。

- [ ] **Step 3: 执行密钥和断网测试**

测试把 API Key 写入输入、模型响应、错误和导出路径，运行文件/日志扫描确认无明文；在 Ollama 模式断网后执行编辑、版本恢复和导出。运行 `npm test -- --run tests/integration/security-redaction.test.ts` 与 `npm run test:e2e -- tests/e2e/failure-recovery.spec.ts`，预期无密钥泄露且任务状态可恢复。

### Task 14: 实现 Markdown/JSON 导出和回读

**Files:**
- Create: `src/application/services/export-service.ts`
- Create: `src/infrastructure/export-writer.ts`
- Create: `src/application/services/import-project-service.ts`
- Test: `tests/integration/export-roundtrip.test.ts`
- Test: `tests/e2e/export.spec.ts`

- [ ] **Step 1: 实现四类 Markdown 产物导出**

按顺序导出分集剧本、资产提取/提示词、资产板提示词、Seedance2 镜头组；导出 Markdown 中保留集、场、镜头和 `@` 资产名。

- [ ] **Step 2: 实现版本化 JSON 导出**

JSON 顶层包含 `exportSchemaVersion`、项目 ID、版本 ID、生成记录引用、故事圣经、剧本、评分、资产、板提示词和镜头组；不包含 secret 值。导出路径不能静默覆盖非项目文件。

- [ ] **Step 3: 实现回读和 round-trip 测试**

导出的 JSON 回读后重新建立对象图，Markdown 仅作为人类交付物不作为唯一数据源。运行 `npm test -- --run tests/integration/export-roundtrip.test.ts`，预期 ID、文本、资产引用和镜头组顺序一致。

### Task 15: 建立 AI 质量评测集和发布候选门禁

**Files:**
- Create: `tests/fixtures/README.md`
- Create: `tests/fixtures/manifest.json`
- Create: `tests/fixtures/novel-short.md`
- Create: `tests/fixtures/dialogue-dense.md`
- Create: `tests/fixtures/action-dense.md`
- Create: `tests/fixtures/logic-defect.md`
- Create: `tests/evaluation/evaluation-runner.ts`
- Create: `scripts/scan-secrets.ps1`
- Modify: `README.md`

- [ ] **Step 1: 准备至少 20 份固定样例和人工基准**

样例覆盖一句话创意、短剧、长文本、对白密集、动作密集、逻辑缺陷、可读 UI、重复道具和多场景承接。`manifest.json` 为每份样例记录关键人物、锁定事实、预期问题、合理时长、不可接受改写和目标模型配置。

- [ ] **Step 2: 实现评测指标**

`evaluation-runner.ts` 输出 Schema 通过率、原文事实保留率、受保护台词保留率、来源外事实数量、连续性问题召回率、四宫格对齐率、平均耗时和错误恢复率，并按 Ollama/API 分组保存脱敏结果。

- [ ] **Step 3: 实现发布命令和干净环境检查**

在 `package.json` 添加 `evaluate`、`scan:secrets` 和 `release:check`。`release:check` 依次运行格式、lint、类型、单元/集成测试、E2E、评测、密钥扫描和 Tauri 构建。执行：

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run test:e2e
npm run evaluate
powershell -ExecutionPolicy Bypass -File scripts/scan-secrets.ps1
npm run tauri:build
```

预期：P0 测试 100% 通过、整体测试 >= 95%、无 S0/S1、密钥扫描 0 命中、构建退出码为 0。

## 5. 里程碑和出口条件

### M0：工程可运行

Task 1-3 完成。可以离线创建项目、保存原稿、创建版本、关闭重开和导出空项目；数据库迁移和 smoke E2E 通过。

### M1：剧本智能闭环

Task 4-8 完成。Ollama/API 均可连接；一句话创意或剧本导入可以完成解析、评分、引用定位、受控改写、差异查看和版本恢复；声音台账、禁止臆造和锁定事实测试通过。

### M2：制作资产闭环

Task 9-11 完成。确认剧本可以提取四类资产、生成自包含资产板提示词和 Seedance2 镜头组；`@` 命名、色卡、四宫格和视频提示词交叉校验通过。

### M3：可交付内测版本

Task 12-15 完成。核心 E2E、长文本、断网、故障恢复、安全扫描和干净环境打包通过；发布候选满足 `ai-drama-product-standards.md` 的 P0 100%、整体 >= 95% 和无 S0/S1 门禁。

## 6. 需求追踪矩阵

| 验收范围 | 对应任务 | 主要测试 |
|---|---|---|
| PRJ/INP/ANA | 1-5、12 | smoke、project-persistence、source-ingestion、core-workflow |
| SCR/RWT/VER | 5-8、12 | source-protection、screenplay-adaptation、scoring、rewrite-versioning |
| SHOT/AST/PRM/EXP | 9-12、14 | asset-extraction、board-prompt-generation、shot-group-generation、export-roundtrip |
| MOD/ERR/OFF/SEC | 4、13、15 | model-adapters、failure-recovery、security-redaction、release-check |
| Skill 剧本格式 | 5-6 | screenplay-format-rules、声音台账比对、Markdown AST |
| Skill 资产板 | 9-10 | asset-naming、board-prompt-rules、单资产复制测试 |
| Skill Seedance2 | 11 | 10 秒组、四宫格/视频提示词 ID 对齐 |

## 7. 开发执行规则

- 每个任务先写失败测试，再实现最小功能，再运行该任务的专项测试。
- 所有模型输出先 Schema 校验，渲染器不得接收未校验对象。
- 每次 AI 生成必须写入模型、参数、prompt 版本、输入版本和时间；日志不写正文以外的 secret。
- 所有破坏性项目操作采用软删除或二次确认，任何 AI 改写不得覆盖原稿。
- 任何新增模型、提示词层、Schema 字段或资产命名规则，都必须重新运行 20 份基准样例。
- 不允许把可验收能力留在隐藏命令或开发脚本中；每项 P0 都必须有用户可操作入口和自动化测试。

## 8. 计划自检

- [x] 已覆盖验收标准中的项目、导入、评分、改写、版本、分镜、资产、提示词、模型、安全、离线和导出要求。
- [x] 已覆盖小说转剧本 Skill 的固定结构、声音台账、VO/OS、标签、禁止臆造和集尾钩子。
- [x] 已覆盖短剧制作流水线 Skill 的四种模式、统一命名、资产板自包含字段、16:9/2K、Seedance2 10 秒组和四宫格顺序。
- [x] 每个任务给出文件边界、测试文件和可执行命令；没有未完成占位项或未定义的功能名。
- [x] 计划从基础设施到纵向切片再到发布门禁，任何阶段均有可验证出口条件。
