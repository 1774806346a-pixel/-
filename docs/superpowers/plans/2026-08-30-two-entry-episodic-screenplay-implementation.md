# 双入口按集短剧剧本工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工作台改为“创意中心/剧本演练”两个直接生成分集短剧剧本的入口，并支持主体大纲与前集剧本承接。

**Architecture:** 保留现有 React + TypeScript + Tauri 仓储与 ModelAdapter。新增一个按集创作状态模型和上下文构建器，复用 `ScreenplayAdaptationService` 的 Schema/格式校验；App 收敛为项目、入口工作台、分集剧本列表和模型设置。

**Tech Stack:** React 19, TypeScript, Zustand-free local React state, Zod, Vitest, Playwright, Tauri repository adapter.

---

### Task 1: 分集上下文与提示词契约

**Files:**
- Create: `src/domain/episodic-workflow.ts`
- Modify: `src/application/prompts/screenplay-prompts.ts`
- Create: `tests/unit/episodic-context.test.ts`
- Modify: `tests/unit/prompt-layers.test.ts`

- [ ] **Step 1: Write failing tests** for `buildEpisodeContext` (episode 1 excludes prior scripts; episode 2 defaults to episode 1; custom references are ordered and deduplicated) and prompt assertions for template headings, outline, episode number, duration, and prior screenplay.
- [ ] **Step 2: Run focused tests** with `npm.cmd test -- --run tests/unit/episodic-context.test.ts tests/unit/prompt-layers.test.ts`; confirm the new context helper and prompt fields fail.
- [ ] **Step 3: Implement the context types/helper** and extend `AdaptationPromptOptions` with `entryType`, `outline`, `episodeNumber`, `previousEpisodes`, and `formatTemplate` while keeping existing callers source-compatible.
- [ ] **Step 4: Run focused tests** and ensure all assertions pass without weakening existing locked-fact/no-invention prompt rules.

### Task 2: 直接生成分集剧本服务与持久化边界

**Files:**
- Modify: `src/application/services/screenplay-adaptation-service.ts`
- Modify: `src/application/services/project-service.ts`
- Modify: `src/infrastructure/project-repository.ts`
- Create: `tests/integration/episodic-screenplay-generation.test.ts`

- [ ] **Step 1: Add failing integration coverage** for creative and source entries, episode 2 receiving outline + episode 1, independent episode records, and generation failure not saving a version.
- [ ] **Step 2: Run the integration test** and capture the expected missing API/state failures.
- [ ] **Step 3: Implement `generateEpisode` orchestration** around the existing adapter, schema validation, Markdown rendering, and `ScreenplayVersion` records. Store input/outline/reference snapshots in repository memory/Tauri-compatible structures; never mutate earlier episodes.
- [ ] **Step 4: Run integration tests** and existing `screenplay-adaptation` tests; fix regressions before handoff.

### Task 3: Two-entry episodic workspace UI

**Files:**
- Create: `src/features/episodic/EpisodicWorkspace.tsx`
- Modify: `src/features/intake/IntakeWorkspace.tsx` (replace diagnostic modes with entry-specific inputs or remove from render path)
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Create: `tests/e2e/two-entry-episodic.spec.ts`

- [ ] **Step 1: Write the E2E test** for two parallel home cards, entering each mode, selecting episode 1/2, editing outline, seeing previous episode reference, generating, and switching episodes without losing saved content.
- [ ] **Step 2: Run the E2E test** against the current app to document expected failures.
- [ ] **Step 3: Implement the workspace** with a left input/control pane and right result/reference pane. Include entry labels, episode selector with create-any-positive-integer behavior, duration control, outline editor, previous episode checkboxes, busy/cancel/error states, and rendered Markdown result. Use buttons/icons consistent with existing styles and keep model settings accessible.
- [ ] **Step 4: Simplify App navigation** to project/home, episodic workspace, screenplay list/export, and settings; remove downstream stage rendering and stale diagnosis state.
- [ ] **Step 5: Run the E2E test** and update selectors only where they reflect stable accessible labels.

### Task 4: Template asset, export, and regression cleanup

**Files:**
- Create: `references/format-template.md`
- Modify: `src/application/renderers/screenplay-markdown-renderer.ts`
- Modify: `src/application/services/export-service.ts`
- Modify: `tests/unit/screenplay-format-rules.test.ts`
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Add failing template-format tests** for the required top headings, scene headings, `△` action lines, emotion labels, and hook cards.
- [ ] **Step 2: Add the canonical `references/format-template.md`** matching the user-provided output rules and make prompt construction use it when present, with an identical in-app fallback.
- [ ] **Step 3: Update Markdown/export rendering** to preserve episode number and adaptation/quality sections and keep each episode separately exportable.
- [ ] **Step 4: Run format-rule, renderer, export, and smoke tests**; remove assertions tied to deleted downstream stages.

### Task 5: Full verification and handoff

**Files:**
- No new source files; update tests only if failures expose an implementation defect.

- [ ] **Step 1: Run `npm.cmd run typecheck` and `npm.cmd run build`.**
- [ ] **Step 2: Run all Vitest tests with `npm.cmd test -- --run`.**
- [ ] **Step 3: Run Playwright smoke and episodic suites.**
- [ ] **Step 4: Inspect `git diff --check` where available and report the repository limitation (no `.git` directory) alongside the validated file list.
