# 模型资产分析与持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让资产提取由大模型分析决定，并把跨集数资产与资产板提示词持久化到 SQLite。

**Architecture:** 前端发送全部剧本和已有资产给模型，使用严格 JSON schema 解析并与规则提取结果合并；Tauri repository 新增项目资产读写命令，将资产和提示词写入现有 SQLite 表。模型失败时保留已有资产并使用规则结果兜底。

**Tech Stack:** React 19, TypeScript, Zod, Tauri 2, Rust, SQLx SQLite, Vitest.

---

### Task 1: Structured model asset analysis

**Files:**
- Create: `src/application/services/model-asset-analysis-service.ts`
- Modify: `src/application/prompts/asset-prompts.ts`
- Test: `tests/integration/asset-extraction.test.ts`

- [ ] Add a prompt builder requesting only scene/character/prop JSON with production-worthiness and appearance locations.
- [ ] Add a service that runs the adapter, parses JSON, validates fields, and merges model output with deterministic assets and existing assets.
- [ ] Add tests for valid output, invalid output fallback, and preserving an asset absent from the newest episode.

### Task 2: SQLite asset persistence

**Files:**
- Modify: `src/infrastructure/project-repository.ts`
- Modify: `src/application/services/project-service.ts`
- Modify: `src-tauri/src/commands/projects.rs`
- Modify: `src-tauri/src/db/repository.rs`
- Modify: `src-tauri/src/db/models.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `tests/integration/project-persistence.test.ts`

- [ ] Add repository methods to load and replace project assets and board prompts.
- [ ] Add Tauri commands that upsert assets and prompts in a transaction without deleting older assets that are absent from a new model response.
- [ ] Add persistence coverage for loading assets after replacement.

### Task 3: UI model workflow

**Files:**
- Modify: `src/features/episodic/EpisodicWorkspace.tsx`
- Modify: `src/features/assets/AssetsWorkspace.tsx`

- [ ] Load persisted assets when opening a project.
- [ ] Send all saved episodes and existing assets to the model when extracting, then persist merged assets and generated board prompts.
- [ ] Display model/fallback warnings and preserve old assets on failure.

### Task 4: Verification

- [ ] Run full Vitest suite, typecheck, and `cargo check --release`.
- [ ] Run `npx.cmd tauri build --no-bundle` and verify the release exe.
