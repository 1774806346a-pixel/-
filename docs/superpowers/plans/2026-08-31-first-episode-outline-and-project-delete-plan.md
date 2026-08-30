# 首集大纲与永久删除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首集先生成并复用故事大纲，同时为项目提供可确认的永久删除流程。

**Architecture:** React 工作区负责顺序编排两次模型调用和展示大纲；Tauri repository 将丰富前端模型映射为持久化 DTO。永久删除新增一个明确的 Tauri 命令，在 SQLite 事务中清理子表和项目记录。

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, SQLx SQLite, Vitest.

---

### Task 1: 首集大纲生成流程

**Files:**
- Modify: `src/features/episodic/EpisodicWorkspace.tsx`
- Modify: `src/application/prompts/screenplay-prompts.ts`
- Test: `tests/integration/episodic-screenplay-generation.test.ts`

- [ ] **Step 1: Write the failing test** for a first-episode request with an empty outline, asserting the adapter is called once for an outline and once for the screenplay and the saved generation context contains the outline.
- [ ] **Step 2: Run the focused test** with `npm.cmd test -- --run tests/integration/episodic-screenplay-generation.test.ts` and confirm it fails.
- [ ] **Step 3: Implement the sequential outline then screenplay flow** in the workspace, using the existing adapter and cancellation signal; add a dedicated prompt builder and keep existing non-first-episode behavior unchanged.
- [ ] **Step 4: Run the focused test and typecheck** and confirm both pass.

### Task 2: Permanent project deletion

**Files:**
- Modify: `src/infrastructure/project-repository.ts`
- Modify: `src/app/App.tsx`
- Modify: `src-tauri/src/commands/projects.rs`
- Modify: `src-tauri/src/db/repository.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `tests/integration/project-persistence.test.ts`

- [ ] **Step 1: Write the failing repository test** asserting permanent deletion removes a project and its saved source/version records.
- [ ] **Step 2: Run the focused persistence test** and confirm it fails because the repository method does not exist.
- [ ] **Step 3: Add `deleteProjectPermanently` to the repository interface and both implementations**, add the Tauri command and SQLite transaction, and add a confirmed delete button to the project list.
- [ ] **Step 4: Run persistence tests, typecheck, and `cargo check --release`** and confirm they pass.

### Task 3: Release verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run `npm.cmd test -- --run` and `npm.cmd run typecheck`.
- [ ] **Step 2: Run `npx.cmd tauri build --no-bundle` to refresh `src-tauri/target/release/ai-drama-workbench.exe`.
- [ ] **Step 3: Confirm the release exe timestamp is newer than the source changes and report the path.
