# AI Drama Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前工作台从“状态文案 Demo”升级为可持久化、可追溯、可验证的双入口 AI 剧本生产流水线。

**Architecture:** React UI 只调用应用服务；应用服务编排结构化任务、模型适配器和项目仓储；Rust/Tauri 负责 SQLite、文件系统和安全存储。原稿、解析快照、故事圣经、剧本版本、评分、资产、分镜和导出记录通过稳定 ID 形成项目图，模型输出先经 Schema 和确定性规则校验，再渲染为界面或 Markdown。

**Tech Stack:** Tauri 2, Rust, SQLite/SQLx, React 19, TypeScript, Vitest, Playwright, Zod, Ollama API, OpenAI-compatible API。

---

## 计划范围与顺序

子任务按依赖顺序串行执行。每个任务由一个新 subagent 实现，并依次经过规格审查和代码质量审查；审查未通过时由原实现代理修复后再进入下一任务。

依赖关系：

```text
A 项目持久化
  -> B 双入口解析
  -> C 故事圣经与版本
  -> D 评分与改写
  -> E 资产/分镜/导出
  -> F 模型配置与安全收口
```

## 文件地图

- `src/domain/models.ts`：稳定领域实体和状态类型。
- `src/domain/schemas/*.ts`：模型输出和导出 JSON Schema。
- `src/application/services/*.ts`：各阶段编排服务。
- `src/application/model/*.ts`：统一模型请求、任务和错误协议。
- `src/infrastructure/project-repository.ts`：浏览器/测试仓储适配器。
- `src-tauri/src/commands/*.rs`：Tauri 项目、源稿、生成结果和安全存储命令。
- `src-tauri/migrations/*.sql`：SQLite 表和索引。
- `src/app/App.tsx`：应用壳和阶段路由；复杂阶段 UI 放入 `src/features/**`。
- `tests/unit/**/*.test.ts`：纯规则和状态机测试。
- `tests/integration/**/*.test.ts`：服务、适配器和仓储集成测试。
- `tests/e2e/*.spec.ts`：真实用户主流程。

### Task 1: 项目与原稿持久化闭环

**Files:**
- Modify: `src-tauri/src/commands/projects.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/db/repository.rs`
- Modify: `src-tauri/migrations/001_initial.sql`
- Modify: `src/infrastructure/project-repository.ts`
- Modify: `src/application/services/project-service.ts`
- Modify: `src/app/App.tsx`
- Create: `tests/integration/project-workflow.test.ts`
- Create: `tests/e2e/project-persistence.spec.ts`

- [ ] **Step 1: 写项目生命周期失败测试**

测试必须覆盖：创建项目返回稳定 ID；保存原稿后能按项目读取；最近项目点击能打开；软删除后列表隐藏；重启仓储后数据仍存在。

- [ ] **Step 2: 运行测试确认失败**

运行 `npm.cmd test -- --run tests/integration/project-workflow.test.ts`，预期当前 UI 内存列表无法满足持久化断言。

- [ ] **Step 3: 实现项目和原稿命令**

补齐类型化 `createProject/openProject/saveSource/listProjects/softDeleteProject` 调用；`source_documents` 只允许追加，不提供覆盖原稿正文的更新路径；Tauri 命令使用事务和稳定 ID。

- [ ] **Step 4: 接通 UI**

创建项目后立即打开项目详情；最近项目行调用 `openProject`；输入保存按钮写入 `SourceDocument`，显示文件名、字符数、hash 和保存时间。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/project-workflow.test.ts`、`npm.cmd run typecheck` 和 `npm.cmd run build`，预期全部通过。

- [ ] **Step 6: 提交**

提交信息：`feat: persist projects and immutable source documents`。

### Task 2: 双入口输入与结构化解析

**Files:**
- Create: `src/domain/schemas/intake.schema.ts`
- Create: `src/application/services/idea-diagnosis-service.ts`
- Create: `src/application/services/source-analysis-service.ts`
- Modify: `src/application/services/source-ingestion-service.ts`
- Modify: `src/application/prompts/*.ts`
- Modify: `src/app/App.tsx`
- Create: `src/features/intake/IntakeWorkspace.tsx`
- Create: `src/features/intake/ParseResultTree.tsx`
- Create: `tests/integration/idea-diagnosis.test.ts`
- Create: `tests/integration/source-analysis.test.ts`
- Create: `tests/e2e/intake-analysis.spec.ts`

- [ ] **Step 1: 写 Schema 和失败测试**

固定 `IdeaDiagnosis` 与 `SourceAnalysis` 字段：输入类型、摘要、人物、冲突、事件、结构节点、对白、动作、待确认项、引用位置、模型元数据。测试无效 JSON、缺字段和未知节点必须进入待复核状态。

- [ ] **Step 2: 实现一句话创意诊断**

使用统一 `ModelAdapter.generate`，要求 JSON Schema 输出；失败时不创建剧本版本，只保存任务失败记录。结果必须包含创意卖点、风险和待确认问题。

- [ ] **Step 3: 实现已有原稿分析**

保留确定性 Markdown 解析作为格式化剧本的快速路径；小说/梗概/自由文本交给模型抽取；两种结果统一成 `SourceAnalysis`，并保留原文行号或字符区间。

- [ ] **Step 4: 接入输入页**

保存后显示“开始创意诊断”或“开始解析”；运行中显示阶段和取消按钮；成功后展示原文、节点树、人物/对白/动作摘要和待复核列表；用户确认后保存解析快照。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/idea-diagnosis.test.ts tests/integration/source-analysis.test.ts` 和 `npm.cmd run test:e2e -- tests/e2e/intake-analysis.spec.ts`。

- [ ] **Step 6: 提交**

提交信息：`feat: add idea diagnosis and source analysis flows`。

### Task 3: 故事圣经与剧本版本中心

**Files:**
- Create: `src/domain/schemas/story-bible.schema.ts`
- Create: `src/application/services/story-bible-workflow-service.ts`
- Create: `src/application/services/version-service.ts`
- Create: `src/features/story-bible/StoryBibleWorkspace.tsx`
- Create: `src/features/versions/VersionCenter.tsx`
- Modify: `src-tauri/src/commands/projects.rs`
- Modify: `src/infrastructure/project-repository.ts`
- Create: `tests/integration/story-bible.test.ts`
- Create: `tests/integration/version-center.test.ts`
- Create: `tests/e2e/version-recovery.spec.ts`

- [ ] **Step 1: 写锁定事实和版本失败测试**

测试锁定人物、关系、时间线和剧情事实；测试任何修改都产生新版本；测试差异、恢复和确认定稿；测试修改锁定事实时返回影响范围。

- [ ] **Step 2: 实现故事圣经流程**

从创意诊断或解析快照生成结构化故事圣经；支持编辑、锁定、解锁；锁定条目包含来源位置和更新时间。

- [ ] **Step 3: 实现版本中心**

实现版本父子关系、完整结构化正文、Markdown 渲染、状态转换、差异和恢复。原稿版本不可变；恢复操作创建新的恢复版本，不删除历史版本。

- [ ] **Step 4: 接入 UI**

增加故事圣经和版本阶段；显示版本来源、模型记录、锁定事实和影响提示；提供“确认剧本”门禁。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/story-bible.test.ts tests/integration/version-center.test.ts`、`npm.cmd run typecheck` 和 `npm.cmd run build`。

- [ ] **Step 6: 提交**

提交信息：`feat: add story bible and screenplay version center`。

### Task 4: 八维评分与受控改写

**Files:**
- Modify: `src/application/services/screenplay-scoring-service.ts`
- Modify: `src/application/services/screenplay-rewrite-service.ts`
- Create: `src/application/services/rewrite-workflow-service.ts`
- Create: `src/features/diagnosis/ScoreReportPanel.tsx`
- Create: `src/features/screenplay/RewriteWorkspace.tsx`
- Modify: `src/application/prompts/prompt-layers.ts`
- Modify: `src-tauri/src/commands/projects.rs`
- Create: `tests/integration/score-rewrite-workflow.test.ts`
- Create: `tests/e2e/score-rewrite.spec.ts`

- [ ] **Step 1: 写评分和改写失败测试**

测试八个维度、权重、证据定位、目标画像、自定义提示词优先级、锁定事实保护和版本创建。

- [ ] **Step 2: 实现评分工作流**

评分请求关联当前输入版本；解析模型 JSON 后做分数范围、权重总和、证据位置和无来源建议校验；失败不覆盖当前版本。

- [ ] **Step 3: 实现受控改写**

支持全文、单集、场次、段落范围；合并内部规则、故事圣经、任务指令和用户提示词；返回差异、事实变化、风险和新版本候选。

- [ ] **Step 4: 接入诊断/改写页面**

评分报告每项可点击定位原文；改写前显示范围和提示词预览；改写后并排展示差异，用户确认后才保存为正式版本。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/score-rewrite-workflow.test.ts` 和 `npm.cmd run test:e2e -- tests/e2e/score-rewrite.spec.ts`。

- [ ] **Step 6: 提交**

提交信息：`feat: connect scoring and controlled rewrite workflows`。

### Task 5: 资产、分镜、质量检查与导出

**Files:**
- Modify: `src/application/services/asset-extraction-service.ts`
- Modify: `src/application/services/board-prompt-service.ts`
- Modify: `src/application/services/shot-group-service.ts`
- Create: `src/application/services/production-workflow-service.ts`
- Create: `src/features/assets/AssetsWorkspace.tsx`
- Create: `src/features/shots/ShotGroupWorkspace.tsx`
- Modify: `src/application/services/export-service.ts`
- Create: `tests/integration/production-workflow.test.ts`
- Create: `tests/e2e/production-export.spec.ts`

- [ ] **Step 1: 写生产链失败测试**

测试未确认剧本不能生成资产；测试资产命名、悬空引用、重复道具/UI；测试镜头 ID、10 秒组、对白锁定、总时长、四宫格和视频提示词；测试 Markdown/JSON 导出回读。

- [ ] **Step 2: 实现资产工作流**

从确认版本提取四类资产，记录首次出现和全部引用；允许编辑、合并、删除和锁定；下游提示词只引用稳定资产 ID。

- [ ] **Step 3: 实现分镜工作流**

按集/场生成镜头组，先生成结构化 shots，再生成四宫格和视频提示词；执行确定性规则校验并展示失败字段和来源位置。

- [ ] **Step 4: 接入导出和 UI**

增加资产、分镜和导出阶段；每个提示词块可单独复制；导出前执行脱敏、关系完整性和回读检查。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/production-workflow.test.ts`、`npm.cmd run test:e2e -- tests/e2e/production-export.spec.ts` 和 `npm.cmd run build`。

- [ ] **Step 6: 提交**

提交信息：`feat: complete asset shot and export pipeline`。

### Task 6: 模型配置、安全存储与全链路状态

**Files:**
- Modify: `src/application/model/model-profile.ts`
- Modify: `src/infrastructure/secret-store.ts`
- Create: `src/application/task/workflow-task-service.ts`
- Modify: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/secrets.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/features/settings/ModelSettingsWorkspace.tsx`
- Modify: `scripts/scan-secrets.ps1`
- Create: `tests/integration/model-profile-persistence.test.ts`
- Create: `tests/integration/task-recovery.test.ts`
- Create: `tests/e2e/model-settings-and-failure.spec.ts`

- [ ] **Step 1: 写模型配置和失败恢复测试**

测试多个 Ollama/API profile、切换不丢项目内容、连接测试、密钥重启后可读取、鉴权/超时/额度/上下文错误分类、取消和最多两次重试。

- [ ] **Step 2: 实现安全存储**

Windows 使用 Tauri/Rust 接入系统凭据存储；浏览器开发模式使用明确标记的本地加密/测试适配器；API Key 不进入项目 JSON、导出、错误消息和普通日志。

- [ ] **Step 3: 实现统一任务状态**

所有模型任务进入 `idle -> ready -> running -> succeeded/failed/cancelled` 状态机；保存当前输入版本；失败不创建成功版本；提供重试和切换模型。

- [ ] **Step 4: 接入模型设置和全链路**

设置页显示 profile 列表、供应商、Base URL、模型名、掩码 API Key、连接测试和当前配置；生成记录写入配置 ID、模型、参数和 Prompt 版本。

- [ ] **Step 5: 验证**

运行 `npm.cmd test -- --run tests/integration/model-profile-persistence.test.ts tests/integration/task-recovery.test.ts`、`npm.cmd run test:e2e -- tests/e2e/model-settings-and-failure.spec.ts`、`npm.cmd run scan:secrets` 和 `npm.cmd run release:check`。

- [ ] **Step 6: 提交**

提交信息：`feat: secure model profiles and recoverable generation tasks`。

## 最终审查

- [ ] 所有 P0 验收项均有集成或 E2E 证据。
- [ ] 清洁环境下 `npm.cmd install`、`npm.cmd run tauri:dev` 和 `npm.cmd run tauri:build` 可执行。
- [ ] 关闭并重新打开应用后，原稿、版本、评分、故事圣经、资产、分镜和提示词关系不丢失。
- [ ] Ollama 未启动、模型不存在、自定义 API 鉴权失败、超时和上下文超限均可恢复。
- [ ] 至少 20 份评测夹具覆盖一句话创意、长文本、对白密集、动作密集、逻辑缺陷、重复资产和跨场承接。
- [ ] 最终代码审查通过后，再进入发布候选构建。
