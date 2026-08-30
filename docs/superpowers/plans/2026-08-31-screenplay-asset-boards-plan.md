# 剧本资产提取与资产板提示词 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从项目全部剧本版本提取场景、人物、道具并生成可复制的资产板图片提示词。

**Architecture:** 应用服务合并版本后复用现有资产命名、去重和资产板规则；React 工作区负责触发提取、分类展示和复制提示词。结果暂存于当前工作区，不改变原剧本或数据库契约。

**Tech Stack:** React 19, TypeScript, Vitest.

---

### Task 1: Cross-episode asset extraction

**Files:**
- Modify: `src/application/services/asset-extraction-service.ts`
- Test: `tests/integration/asset-extraction.test.ts`

- [ ] Add a function accepting multiple screenplay versions, extracting each version, filtering out `ui`, and merging duplicate assets and appearances.
- [ ] Add tests covering cross-episode deduplication and the three-category filter.
- [ ] Run `npm.cmd test -- --run tests/integration/asset-extraction.test.ts`.

### Task 2: Asset workspace integration

**Files:**
- Modify: `src/features/assets/AssetsWorkspace.tsx`
- Modify: `src/features/episodic/EpisodicWorkspace.tsx`
- Modify: `src/app/styles.css`

- [ ] Add grouped rendering for scenes, characters, and props with prompt copy actions and empty states.
- [ ] Add an extraction action in the episodic workspace using all loaded versions and existing board prompt generation.
- [ ] Run `npm.cmd run typecheck` and focused UI-related tests.

### Task 3: Release verification

**Files:**
- No source changes expected.

- [ ] Run the full Vitest suite and typecheck.
- [ ] Run `npx.cmd tauri build --no-bundle` to refresh the release exe.
