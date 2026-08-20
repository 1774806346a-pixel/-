# 戏匠 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first web application where creators can turn a Chinese ancient-drama idea into an editable story package or diagnose and revise an existing script with version history.

**Architecture:** Use a Next.js App Router application with server-rendered project pages and small client-side workbench components. Persist projects and immutable revision snapshots in a local SQLite database through Prisma; route all model work through one typed AI provider interface so the UI and persistence layers do not depend on OpenAI response details. Use OpenAI structured outputs in production and a deterministic fixture provider for automated tests.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Lucide React, Prisma ORM with SQLite, Zod, OpenAI JavaScript SDK, Vitest, React Testing Library, Playwright.

---

## File Structure

The workspace is empty. Create the following structure and keep the responsibilities below separate:

- `package.json`: scripts and dependency manifest.
- `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`: framework and test configuration.
- `.env.example`: documents required local environment variables without storing secrets.
- `prisma/schema.prisma`: SQLite persistence schema.
- `prisma/seed.ts`: deterministic local sample project for manual inspection.
- `src/lib/db.ts`: one reusable Prisma client.
- `src/lib/domain/types.ts`: application-level types shared by server and client code.
- `src/lib/domain/script.ts`: pure script-segmentation and revision utility functions.
- `src/lib/ai/schemas.ts`: Zod contracts for every AI request and structured response.
- `src/lib/ai/provider.ts`: `AiProvider` interface and typed model operations.
- `src/lib/ai/openai-provider.ts`: OpenAI structured-output implementation.
- `src/lib/ai/fixture-provider.ts`: deterministic provider used in tests.
- `src/lib/ai/index.ts`: provider selection and availability errors.
- `src/lib/repositories/projects.ts`: database reads and writes for projects and immutable revisions.
- `src/app/actions/projects.ts`: Server Actions for creating, diagnosing, revising, renaming, restoring, and deleting projects.
- `src/app/layout.tsx`, `src/app/globals.css`: global shell and application visual system.
- `src/app/page.tsx`: project home and empty state.
- `src/app/projects/new/page.tsx`: mode selection screen.
- `src/app/projects/new/create/page.tsx`: idea-to-story form.
- `src/app/projects/new/optimize/page.tsx`: existing-script input form.
- `src/app/projects/[projectId]/page.tsx`: server project loader and mode router.
- `src/components/*`: focused UI components for forms, editors, diagnosis, revisions, and error states.
- `src/test/*`: Vitest setup, factories, and unit/component tests.
- `e2e/*`: Playwright browser coverage for the two primary workflows.

Use a single local user workspace in MVP. Do not add authentication, billing, image/video generation, collaboration, or storyboard prompt generation.

## Data Contract

Define these application types in `src/lib/domain/types.ts` and use their Zod counterparts from `src/lib/ai/schemas.ts` to validate all persisted model output:

```ts
export type ProjectMode = "CREATE" | "OPTIMIZE";
export type RevisionType =
  | "INITIAL_STORY"
  | "INITIAL_DIAGNOSIS"
  | "SEGMENT_REWRITE"
  | "EPISODE_REWRITE"
  | "RESTORE";
export type RewriteStrategy =
  | "CONSERVATIVE"
  | "MORE_PAYOFF"
  | "MORE_EMOTION"
  | "STRONGER_TWIST";

export type StoryBrief = {
  idea: string;
  durationMinutes: number;
  subgenre?: string;
  payoff?: string;
  preserve?: string;
};

export type CharacterCard = {
  id: string;
  name: string;
  identity: string;
  desire: string;
  secret: string;
  relationships: string;
  visualTraits: string;
};

export type StoryPackage = {
  title: string;
  logline: string;
  worldRules: string;
  characters: CharacterCard[];
  outline: {
    openingHook: string;
    escalation: string;
    reversal: string;
    endingCliffhanger: string;
  };
  keyScenes: string[];
};

export type ScriptSegment = {
  id: string;
  index: number;
  heading: string | null;
  text: string;
};

export type DiagnosisScore = {
  score: number;
  summary: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export type ScriptAnnotation = {
  segmentId: string;
  label: string;
  reason: string;
  suggestion: string;
  replacement?: string;
};

export type ScriptDiagnosis = {
  scores: {
    hook: DiagnosisScore;
    conflict: DiagnosisScore;
    character: DiagnosisScore;
    pacing: DiagnosisScore;
    twist: DiagnosisScore;
  };
  priorityIssues: string[];
  revisionRoute: string[];
  annotations: ScriptAnnotation[];
};

export type RevisionContent = {
  brief?: StoryBrief;
  storyPackage?: StoryPackage;
  script?: {
    rawText: string;
    durationMinutes: number;
    preserve?: string;
    segments: ScriptSegment[];
  };
  diagnosis?: ScriptDiagnosis;
  rewrittenSegment?: {
    segmentId: string;
    strategy: RewriteStrategy;
    text: string;
  };
};
```

Persist `RevisionContent` as validated JSON text in a revision snapshot. This preserves the entire creative state needed to restore a project while keeping the initial schema small.

### Task 1: Initialize the application and quality gates

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Initialize Git so implementation commits can be made**

Run:

```powershell
git init
git add docs\superpowers\specs\2026-08-20-xijiang-ai-drama-screenwriting-design.md docs\superpowers\plans\2026-08-20-xijiang-mvp-implementation.md
git commit -m "docs: add xijiang design and implementation plan"
```

Expected: `git status --short` reports no changes after the commit.

- [ ] **Step 2: Scaffold a TypeScript App Router project**

Run:

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*" --no-turbopack
npm install @prisma/client @prisma/adapter-better-sqlite3 better-sqlite3 zod openai lucide-react clsx
npm install -D prisma @types/better-sqlite3 vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom playwright
npx playwright install chromium
```

Expected: `package.json` contains `dev`, `build`, `lint`, and `test` scripts, and `src/app/page.tsx` exists.

- [ ] **Step 3: Add explicit scripts and environment documentation**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

Create `.env.example`:

```dotenv
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL=""
AI_PROVIDER="openai"
```

`OPENAI_MODEL` must be set to an account-available structured-output-capable model in local development. Tests set `AI_PROVIDER="fixture"` and never make network calls.

- [ ] **Step 4: Add a minimal app shell before feature work**

Replace the default page with:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
      <h1 className="text-3xl font-semibold text-zinc-950">戏匠</h1>
    </main>
  );
}
```

Add a CSS reset and the following core visual tokens to `src/app/globals.css`:

```css
:root {
  --canvas: #f7f5ef;
  --ink: #20221e;
  --muted: #6c7069;
  --line: #d8d7cf;
  --jade: #1d6357;
  --vermilion: #b73b2d;
  --paper: #fffef9;
}
```

- [ ] **Step 5: Configure Vitest and prove the suite runs**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Run:

```powershell
npm run lint
npm run test
npm run build
```

Expected: all three commands exit with code `0`.

- [ ] **Step 6: Commit the initialized application**

Run:

```powershell
git add .
git commit -m "chore: initialize nextjs application"
```

### Task 2: Create validated story and script domain utilities

**Files:**
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/script.ts`
- Create: `src/lib/ai/schemas.ts`
- Test: `src/lib/domain/script.test.ts`
- Test: `src/lib/ai/schemas.test.ts`

- [ ] **Step 1: Write segmentation tests**

Create `src/lib/domain/script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { segmentScript } from "@/lib/domain/script";

describe("segmentScript", () => {
  it("uses scene headings and blank lines to create stable segments", () => {
    expect(
      segmentScript("【云台宫·夜】\n沈昭拔剑。\n\n【山门·夜】\n钟声骤响。"),
    ).toEqual([
      { id: "segment-1", index: 0, heading: "云台宫·夜", text: "沈昭拔剑。" },
      { id: "segment-2", index: 1, heading: "山门·夜", text: "钟声骤响。" },
    ]);
  });

  it("returns one segment when there is no scene heading", () => {
    expect(segmentScript("少年在雨中跪了三日。")).toEqual([
      {
        id: "segment-1",
        index: 0,
        heading: null,
        text: "少年在雨中跪了三日。",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify the utility does not exist yet**

Run:

```powershell
npm run test -- src/lib/domain/script.test.ts
```

Expected: FAIL with a module-not-found error for `@/lib/domain/script`.

- [ ] **Step 3: Define domain types and implement segmentation**

Create `src/lib/domain/types.ts` using the complete `Data Contract` in this plan.

Create `src/lib/domain/script.ts`:

```ts
import type { ScriptSegment } from "@/lib/domain/types";

const scenePattern = /^【(.+?)】\s*$/;

export function segmentScript(rawText: string): ScriptSegment[] {
  const blocks = rawText
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split("\n");
    const match = lines[0].match(scenePattern);
    const text = (match ? lines.slice(1) : lines).join("\n").trim();

    return {
      id: `segment-${index + 1}`,
      index,
      heading: match?.[1] ?? null,
      text: text || lines[0],
    };
  });
}
```

- [ ] **Step 4: Define the model schemas and write schema tests**

Create tests that validate a full `StoryPackage` and reject an annotation whose `segmentId` is blank:

```ts
import { describe, expect, it } from "vitest";
import { scriptDiagnosisSchema, storyPackageSchema } from "@/lib/ai/schemas";

describe("AI response schemas", () => {
  it("accepts a complete story package", () => {
    expect(() =>
      storyPackageSchema.parse({
        title: "寒灯照骨",
        logline: "被逐弟子夺回命格。",
        worldRules: "灵骨决定仙途。",
        characters: [{
          id: "shen-zhao",
          name: "沈昭",
          identity: "外门弟子",
          desire: "夺回灵骨",
          secret: "灵骨会反噬",
          relationships: "师姐是旧敌",
          visualTraits: "素衣、旧剑、赤色命纹",
        }],
        outline: {
          openingHook: "宗门当众剥骨。",
          escalation: "她听见古剑开口。",
          reversal: "剥走的是假骨。",
          endingCliffhanger: "真骨在敌人心口发亮。",
        },
        keyScenes: ["刑台", "剑冢"],
      }),
    ).not.toThrow();
  });

  it("rejects annotations without a target segment", () => {
    expect(() =>
      scriptDiagnosisSchema.parse({
        scores: {},
        priorityIssues: [],
        revisionRoute: [],
        annotations: [{ segmentId: "", label: "钩子", reason: "弱", suggestion: "前置危机" }],
      }),
    ).toThrow();
  });
});
```

Implement `storyBriefSchema`, `storyPackageSchema`, `scriptDocumentSchema`, `scriptDiagnosisSchema`, `rewriteStrategySchema`, and `revisionContentSchema`. Make `DiagnosisScore.score` an integer from `1` through `10`, and make all annotation text fields non-empty.

- [ ] **Step 5: Run focused and full unit tests**

Run:

```powershell
npm run test -- src/lib/domain/script.test.ts src/lib/ai/schemas.test.ts
npm run test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the domain contract**

Run:

```powershell
git add src/lib/domain src/lib/ai/schemas.ts src/lib/domain/*.test.ts src/lib/ai/schemas.test.ts
git commit -m "feat: add validated script domain contracts"
```

### Task 3: Add local persistence and immutable revision history

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/lib/repositories/projects.ts`
- Test: `src/lib/repositories/projects.test.ts`

- [ ] **Step 1: Write repository tests against a temporary SQLite database**

Create `src/lib/repositories/projects.test.ts` with a fake repository client interface. Cover these observable behaviors:

```ts
it("creates an initial revision and marks it current", async () => {
  const project = await repository.createProject({
    name: "寒灯照骨",
    mode: "CREATE",
    content: { brief: { idea: "被逐女弟子觉醒神骨", durationMinutes: 3 } },
    type: "INITIAL_STORY",
  });

  expect(project.currentRevision.type).toBe("INITIAL_STORY");
  expect(project.revisions).toHaveLength(1);
});

it("restoring a revision creates a RESTORE snapshot instead of deleting history", async () => {
  const restored = await repository.restoreRevision(projectId, initialRevisionId);

  expect(restored.currentRevision.type).toBe("RESTORE");
  expect(restored.revisions).toHaveLength(3);
  expect(restored.currentRevision.content).toEqual(initialContent);
});
```

Use a test-only `DATABASE_URL="file:./test.db"` and delete this database in Vitest global setup after each test file.

- [ ] **Step 2: Run repository tests to verify they fail**

Run:

```powershell
npm run test -- src/lib/repositories/projects.test.ts
```

Expected: FAIL because the repository and database schema do not exist.

- [ ] **Step 3: Create the SQLite schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum ProjectMode {
  CREATE
  OPTIMIZE
}

enum RevisionType {
  INITIAL_STORY
  INITIAL_DIAGNOSIS
  SEGMENT_REWRITE
  EPISODE_REWRITE
  RESTORE
}

model Project {
  id                String      @id @default(cuid())
  name              String
  mode              ProjectMode
  currentRevisionId String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  revisions         Revision[]
}

model Revision {
  id             String       @id @default(cuid())
  projectId      String
  parentId       String?
  type           RevisionType
  strategy       String?
  label          String
  contentJson    String
  createdAt      DateTime     @default(now())
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Run:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

Expected: `prisma/dev.db` and an initial migration exist.

- [ ] **Step 4: Implement the database client and repository boundary**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

Implement these exact repository methods in `src/lib/repositories/projects.ts`:

```ts
createProject(input: {
  name: string;
  mode: ProjectMode;
  type: RevisionType;
  label: string;
  content: RevisionContent;
}): Promise<ProjectWithRevisions>;

getProject(projectId: string): Promise<ProjectWithRevisions | null>;
listProjects(): Promise<ProjectListItem[]>;
appendRevision(input: {
  projectId: string;
  parentId: string | null;
  type: RevisionType;
  strategy?: RewriteStrategy;
  label: string;
  content: RevisionContent;
}): Promise<ProjectWithRevisions>;
restoreRevision(projectId: string, revisionId: string): Promise<ProjectWithRevisions>;
renameProject(projectId: string, name: string): Promise<void>;
deleteProject(projectId: string): Promise<void>;
```

`appendRevision` must serialize `revisionContentSchema.parse(content)` before saving, and update `Project.currentRevisionId` in the same transaction.

- [ ] **Step 5: Run migrations, repository tests, and full verification**

Run:

```powershell
npm run db:generate
npm run test -- src/lib/repositories/projects.test.ts
npm run lint
npm run build
```

Expected: every command exits with code `0`.

- [ ] **Step 6: Commit persistence**

Run:

```powershell
git add prisma src/lib/db.ts src/lib/repositories
git commit -m "feat: persist projects and immutable revisions"
```

### Task 4: Build the AI provider boundary and safe prompts

**Files:**
- Create: `src/lib/ai/provider.ts`
- Create: `src/lib/ai/prompts.ts`
- Create: `src/lib/ai/openai-provider.ts`
- Create: `src/lib/ai/fixture-provider.ts`
- Create: `src/lib/ai/index.ts`
- Test: `src/lib/ai/fixture-provider.test.ts`
- Test: `src/lib/ai/prompts.test.ts`

- [ ] **Step 1: Write deterministic fixture-provider tests**

Create `src/lib/ai/fixture-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtureProvider } from "@/lib/ai/fixture-provider";

describe("fixtureProvider", () => {
  it("creates an ancient-drama story package with a hook and cliffhanger", async () => {
    const result = await fixtureProvider.createStoryPackage({
      idea: "被逐女弟子在剑冢醒来",
      durationMinutes: 3,
      subgenre: "仙侠逆袭",
      payoff: "身份反转",
    });

    expect(result.outline.openingHook).not.toHaveLength(0);
    expect(result.outline.endingCliffhanger).not.toHaveLength(0);
  });

  it("only annotates known segments", async () => {
    const result = await fixtureProvider.diagnoseScript({
      rawText: "【山门·夜】\n她跪在雨中。",
      durationMinutes: 2,
      preserve: "",
    });

    expect(result.annotations[0].segmentId).toBe("segment-1");
  });
});
```

- [ ] **Step 2: Run the fixture test to verify it fails**

Run:

```powershell
npm run test -- src/lib/ai/fixture-provider.test.ts
```

Expected: FAIL because `fixtureProvider` does not exist.

- [ ] **Step 3: Define one typed provider interface**

Create `src/lib/ai/provider.ts`:

```ts
import type {
  RewriteStrategy,
  ScriptDiagnosis,
  StoryBrief,
  StoryPackage,
} from "@/lib/domain/types";

export type DiagnoseInput = {
  rawText: string;
  durationMinutes: number;
  preserve?: string;
};

export type RewriteSegmentInput = DiagnoseInput & {
  segmentId: string;
  segmentText: string;
  strategy: RewriteStrategy;
  diagnosis?: ScriptDiagnosis;
};

export type RewriteEpisodeInput = DiagnoseInput & {
  strategy: RewriteStrategy;
  diagnosis: ScriptDiagnosis;
};

export interface AiProvider {
  createStoryPackage(input: StoryBrief): Promise<StoryPackage>;
  diagnoseScript(input: DiagnoseInput): Promise<ScriptDiagnosis>;
  rewriteSegment(input: RewriteSegmentInput): Promise<string>;
  rewriteEpisode(input: RewriteEpisodeInput): Promise<string>;
}
```

- [ ] **Step 4: Define prompt builders with content constraints**

Create `src/lib/ai/prompts.ts` with a shared system message that requires:

```ts
export const ancientDramaSystemPrompt = `
你是资深古风短剧编剧编辑。输出必须为简体中文。
服务目标是帮助创作者做出可追更的单集古风 AI 漫剧。
开场优先呈现困境、威胁、欲望或身份反常；不得以大段世界观介绍开场。
所有大纲必须明确主角目标、阻碍、代价、局势反转和下一集悬念。
人物行动必须由欲望、恐惧、秘密或关系推动。
写可见、可表演、可制作的行动和场景，避免空泛形容。
不得声称内容一定爆款、一定获得流量或保证商业成功。
`;
```

Implement `buildStoryPrompt`, `buildDiagnosisPrompt`, `buildSegmentRewritePrompt`, and `buildEpisodeRewritePrompt`. `buildDiagnosisPrompt` must include each segment id and demand that annotations reference only those ids.

- [ ] **Step 5: Implement the fixture provider**

Create `src/lib/ai/fixture-provider.ts`. It must:

- Return a non-empty `StoryPackage` whose opening hook and cliffhanger are tied to `input.idea`.
- Call `segmentScript(input.rawText)` before producing a diagnosis.
- Produce all five score dimensions with valid 1-10 integer values.
- Return at least one annotation only when the script has at least one segment.
- Make each rewrite string include the input strategy's intended effect without changing unselected segments.

Validate every fixture return value with the Zod schemas before returning it.

- [ ] **Step 6: Implement OpenAI and provider selection**

Create `src/lib/ai/openai-provider.ts` using the official OpenAI JavaScript SDK. Initialize the client only after verifying `OPENAI_API_KEY` and `OPENAI_MODEL` are present. For each provider method:

1. Build the method-specific prompt from `prompts.ts`.
2. Request a JSON-only structured result matching the relevant Zod schema.
3. Parse the returned JSON with that schema before returning it.
4. Throw `AiUnavailableError` for missing configuration and `AiResponseError` for malformed model output.

Create `src/lib/ai/index.ts`:

```ts
import type { AiProvider } from "@/lib/ai/provider";
import { fixtureProvider } from "@/lib/ai/fixture-provider";
import { openAiProvider } from "@/lib/ai/openai-provider";

export class AiUnavailableError extends Error {}
export class AiResponseError extends Error {}

export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER === "fixture" ? fixtureProvider : openAiProvider;
}
```

- [ ] **Step 7: Run AI tests without network calls**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test -- src/lib/ai
```

Expected: PASS, with no OpenAI network request.

- [ ] **Step 8: Commit the AI boundary**

Run:

```powershell
git add src/lib/ai
git commit -m "feat: add typed AI screenwriting provider"
```

### Task 5: Implement creation, diagnosis, and revision Server Actions

**Files:**
- Create: `src/app/actions/projects.ts`
- Create: `src/lib/validation/forms.ts`
- Test: `src/app/actions/projects.test.ts`

- [ ] **Step 1: Write Server Action tests with repository and provider fakes**

Create tests that inject an `AiProvider` and repository through module-level factories. Cover:

```ts
it("creates a CREATE project from a valid story brief", async () => {
  const result = await createFromBrief({
    idea: "被夺灵骨的女弟子在剑冢苏醒",
    durationMinutes: 3,
    subgenre: "仙侠逆袭",
    payoff: "身份反转",
  });

  expect(result.ok).toBe(true);
  expect(repository.createProject).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "CREATE", type: "INITIAL_STORY" }),
  );
});

it("returns a field error without calling AI for an empty idea", async () => {
  const result = await createFromBrief({ idea: "", durationMinutes: 3 });

  expect(result).toEqual({
    ok: false,
    fieldErrors: { idea: "请先写下一句话灵感。" },
  });
  expect(ai.createStoryPackage).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the Server Action tests to verify they fail**

Run:

```powershell
npm run test -- src/app/actions/projects.test.ts
```

Expected: FAIL because `createFromBrief` is not implemented.

- [ ] **Step 3: Define form validation**

Create `src/lib/validation/forms.ts`:

```ts
import { z } from "zod";

export const storyBriefFormSchema = z.object({
  idea: z.string().trim().min(8, "请先写下一句话灵感。").max(500),
  durationMinutes: z.coerce.number().int().min(1).max(20),
  subgenre: z.string().trim().max(40).optional(),
  payoff: z.string().trim().max(40).optional(),
  preserve: z.string().trim().max(1000).optional(),
});

export const optimizeScriptFormSchema = z.object({
  rawText: z.string().trim().min(20, "请粘贴至少一段剧本内容。").max(30000),
  durationMinutes: z.coerce.number().int().min(1).max(20),
  preserve: z.string().trim().max(1000).optional(),
});
```

Also define schemas for `segmentId`, `projectId`, `revisionId`, `projectName`, and all four `RewriteStrategy` values.

- [ ] **Step 4: Implement the action result contract**

Use this exact result type in `src/app/actions/projects.ts`:

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      message?: string;
      fieldErrors?: Record<string, string>;
    };
```

Implement these actions:

```ts
createFromBrief(input: unknown): Promise<ActionResult<{ projectId: string }>>;
createDiagnosisProject(input: unknown): Promise<ActionResult<{ projectId: string }>>;
rewriteSegment(input: unknown): Promise<ActionResult<{ projectId: string; revisionId: string }>>;
rewriteEpisode(input: unknown): Promise<ActionResult<{ projectId: string; revisionId: string }>>;
restoreProjectRevision(input: unknown): Promise<ActionResult<{ projectId: string }>>;
renameProject(input: unknown): Promise<ActionResult>;
deleteProject(input: unknown): Promise<ActionResult>;
```

For `createDiagnosisProject`, segment the submitted script before calling `diagnoseScript`, then save both `script` and `diagnosis` in an `INITIAL_DIAGNOSIS` revision. For rewrite actions, load the current revision, reject the request when its needed script or diagnosis is absent, and create a new immutable revision. Call `revalidatePath("/")` and `revalidatePath(\`/projects/${projectId}\`)` after every successful mutation.

Map `AiUnavailableError` to `请先在 .env 中配置 OPENAI_API_KEY 与 OPENAI_MODEL。`; map model/network errors to `AI 暂时没有返回可用结果，原内容已保留，请重试。`

- [ ] **Step 5: Run action tests and all unit checks**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test -- src/app/actions/projects.test.ts
$env:AI_PROVIDER="fixture"; npm run test
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 6: Commit application actions**

Run:

```powershell
git add src/app/actions src/lib/validation src/app/actions/projects.test.ts
git commit -m "feat: add project creation and revision actions"
```

### Task 6: Build the project home and two focused new-project flows

**Files:**
- Create: `src/components/app-shell.tsx`
- Create: `src/components/project-list.tsx`
- Create: `src/components/new-project-mode.tsx`
- Create: `src/components/story-brief-form.tsx`
- Create: `src/components/script-input-form.tsx`
- Create: `src/components/form-submit-button.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/projects/new/page.tsx`
- Create: `src/app/projects/new/create/page.tsx`
- Create: `src/app/projects/new/optimize/page.tsx`
- Test: `src/components/story-brief-form.test.tsx`
- Test: `src/components/script-input-form.test.tsx`

- [ ] **Step 1: Write form behavior tests**

Create `src/components/story-brief-form.test.tsx`:

```tsx
it("keeps the submit button disabled until idea and duration are supplied", async () => {
  const user = userEvent.setup();
  render(<StoryBriefForm onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: "生成故事骨架" })).toBeDisabled();
  await user.type(screen.getByLabelText("一句话灵感"), "被逐女弟子在剑冢醒来");
  await user.selectOptions(screen.getByLabelText("单集时长"), "3");

  expect(screen.getByRole("button", { name: "生成故事骨架" })).toBeEnabled();
});
```

Create `src/components/script-input-form.test.tsx`:

```tsx
it("submits source text, duration, and preservation notes", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<ScriptInputForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("剧本文本"), "【山门·夜】\n她在雨中跪了三日。");
  await user.selectOptions(screen.getByLabelText("单集时长"), "2");
  await user.click(screen.getByRole("button", { name: "开始剧本体检" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ durationMinutes: 2 }),
  );
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```powershell
npm run test -- src/components/story-brief-form.test.tsx src/components/script-input-form.test.tsx
```

Expected: FAIL because the forms do not exist.

- [ ] **Step 3: Implement the application shell and project list**

`src/components/app-shell.tsx` must provide:

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">戏匠</Link>
          <Link href="/projects/new" aria-label="新建项目">
            <Plus aria-hidden="true" size={20} />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
```

`ProjectList` must render a compact row for each project with its name, `从灵感创作` or `优化已有剧本` label, last-updated time, and a link to `/projects/[id]`. When empty, it must expose only the two primary links: `从灵感创作` and `优化已有剧本`.

- [ ] **Step 4: Implement both forms and submission states**

Use native `<label>`, `<textarea>`, `<select>`, and field-level error text. Provide durations `1`, `2`, `3`, `5`, `8`, `12`, and `20` minutes.

`StoryBriefForm` fields:

```tsx
<textarea id="idea" name="idea" aria-label="一句话灵感" />
<select id="durationMinutes" name="durationMinutes" aria-label="单集时长" />
<select id="subgenre" name="subgenre" aria-label="古风子类型" />
<select id="payoff" name="payoff" aria-label="核心爽点" />
<textarea id="preserve" name="preserve" aria-label="希望保留的内容" />
```

`ScriptInputForm` uses `剧本文本`, `单集时长`, and `希望保留的内容`. Both forms must invoke their Server Action through `useTransition`, show a disabled submit button while pending, retain user input after an error, and call `router.push(\`/projects/${projectId}\`)` on success.

- [ ] **Step 5: Build the routes**

Implement:

- `/`: fetches `listProjects()` and wraps `ProjectList` in `AppShell`.
- `/projects/new`: mode chooser with the two routes.
- `/projects/new/create`: renders `StoryBriefForm` with `createFromBrief`.
- `/projects/new/optimize`: renders `ScriptInputForm` with `createDiagnosisProject`.

No marketing landing page, hero card, or generic chatbot should be introduced.

- [ ] **Step 6: Run tests and inspect the primary paths**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test -- src/components/story-brief-form.test.tsx src/components/script-input-form.test.tsx
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit project entry flows**

Run:

```powershell
git add src/app src/components
git commit -m "feat: add new project creation flows"
```

### Task 7: Render editable story packages for idea-driven projects

**Files:**
- Create: `src/components/story-package-editor.tsx`
- Create: `src/components/story-section.tsx`
- Create: `src/components/character-card.tsx`
- Create: `src/components/project-header.tsx`
- Create: `src/components/revision-history.tsx`
- Create: `src/app/projects/[projectId]/create-project-view.tsx`
- Modify: `src/app/projects/[projectId]/page.tsx`
- Test: `src/components/story-package-editor.test.tsx`

- [ ] **Step 1: Write editor tests**

Create `src/components/story-package-editor.test.tsx`:

```tsx
it("allows an editor to change a story-package field without mutating the source prop", async () => {
  const source = makeStoryPackage();
  const user = userEvent.setup();
  render(<StoryPackageEditor storyPackage={source} />);

  const title = screen.getByDisplayValue(source.title);
  await user.clear(title);
  await user.type(title, "剑冢归来");

  expect(title).toHaveValue("剑冢归来");
  expect(source.title).toBe("寒灯照骨");
});

it("renders all required story sections", () => {
  render(<StoryPackageEditor storyPackage={makeStoryPackage()} />);

  expect(screen.getByText("一句话卖点")).toBeInTheDocument();
  expect(screen.getByText("世界观与冲突规则")).toBeInTheDocument();
  expect(screen.getByText("主要角色")).toBeInTheDocument();
  expect(screen.getByText("单集剧情大纲")).toBeInTheDocument();
  expect(screen.getByText("关键场景")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run:

```powershell
npm run test -- src/components/story-package-editor.test.tsx
```

Expected: FAIL because `StoryPackageEditor` does not exist.

- [ ] **Step 3: Implement the project route loader**

Create `src/app/projects/[projectId]/page.tsx` that:

1. Calls `getProject(params.projectId)`.
2. Calls `notFound()` when no project exists.
3. Parses `currentRevision.contentJson` with `revisionContentSchema`.
4. Routes `CREATE` projects to `CreateProjectView` and `OPTIMIZE` projects to the optimization view created in Task 8.

Use a project header with an editable project name and a `RevisionHistory` sidebar. The history must list labels such as `初始故事骨架`, `局部改写：增强爽点`, `整集重写：加强反转`, and `恢复自：初始故事骨架`.

- [ ] **Step 4: Implement a local editable story package**

Create `StoryPackageEditor` as a controlled client component with a copy of the incoming `StoryPackage` in state. Render:

- `作品暂名` as a text input.
- `一句话卖点` and `世界观与冲突规则` as textareas.
- Each `CharacterCard` in a compact editable form.
- The five outline beats as individually labeled textareas.
- Key scenes as an editable line list.

Show `未保存修改` only after edits and provide `恢复本次编辑` to reset local state. Do not persist direct text edits in MVP; preserving and reworking content via AI revision is introduced through formal revision actions.

- [ ] **Step 5: Implement revision browsing and restoration**

`RevisionHistory` must:

- Display each immutable revision in reverse chronological order.
- Link the current revision with a clear current marker.
- Offer a restore icon button with `aria-label="恢复此版本"` for non-current revisions.
- Call `restoreProjectRevision` after a `window.confirm("恢复后会创建一个新版本，继续吗？")`.
- Refresh the route after a successful restore.

- [ ] **Step 6: Run focused tests and app checks**

Run:

```powershell
npm run test -- src/components/story-package-editor.test.tsx
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit the creation workbench**

Run:

```powershell
git add src/app/projects src/components/story-package-editor.tsx src/components/story-section.tsx src/components/character-card.tsx src/components/project-header.tsx src/components/revision-history.tsx
git commit -m "feat: render editable story packages and revisions"
```

### Task 8: Build the three-pane script diagnosis and rewrite workbench

**Files:**
- Create: `src/app/projects/[projectId]/optimize-project-view.tsx`
- Create: `src/components/script-segment-list.tsx`
- Create: `src/components/script-segment-detail.tsx`
- Create: `src/components/diagnosis-panel.tsx`
- Create: `src/components/score-card.tsx`
- Create: `src/components/annotation-list.tsx`
- Create: `src/components/rewrite-panel.tsx`
- Test: `src/components/diagnosis-panel.test.tsx`
- Test: `src/components/rewrite-panel.test.tsx`

- [ ] **Step 1: Write diagnosis navigation tests**

Create `src/components/diagnosis-panel.test.tsx`:

```tsx
it("selects the matching script segment when an annotation is clicked", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<DiagnosisPanel diagnosis={makeDiagnosis()} onSelectSegment={onSelect} />);

  await user.click(screen.getByRole("button", { name: /钩子：前置危机/i }));

  expect(onSelect).toHaveBeenCalledWith("segment-2");
});

it("shows all five scoring dimensions", () => {
  render(<DiagnosisPanel diagnosis={makeDiagnosis()} onSelectSegment={vi.fn()} />);

  for (const label of ["钩子", "冲突", "人物", "节奏", "反转"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});
```

- [ ] **Step 2: Write rewrite behavior tests**

Create `src/components/rewrite-panel.test.tsx`:

```tsx
it("submits a selected rewrite strategy and segment", async () => {
  const onRewrite = vi.fn();
  const user = userEvent.setup();
  render(<RewritePanel segment={makeSegment()} onRewrite={onRewrite} />);

  await user.click(screen.getByLabelText("增强爽点"));
  await user.click(screen.getByRole("button", { name: "改写这一段" }));

  expect(onRewrite).toHaveBeenCalledWith({
    segmentId: "segment-1",
    strategy: "MORE_PAYOFF",
  });
});
```

- [ ] **Step 3: Run diagnosis and rewrite tests to verify they fail**

Run:

```powershell
npm run test -- src/components/diagnosis-panel.test.tsx src/components/rewrite-panel.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 4: Implement the three-pane layout**

`OptimizeProjectView` must create these stable regions:

```tsx
<section className="grid min-h-[calc(100vh-5rem)] grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.4fr)_minmax(280px,0.9fr)] border-t border-[var(--line)]">
  <ScriptSegmentList ... />
  <ScriptSegmentDetail ... />
  <DiagnosisPanel ... />
</section>
```

On screens narrower than `1024px`, switch to vertically stacked sections in the same order, with no overlapping text or independently scrolling nested cards.

- [ ] **Step 5: Implement diagnosis display**

`DiagnosisPanel` must render:

- Five `ScoreCard` items: score out of 10, priority visual treatment, and summary.
- A concise `优先处理` list using `diagnosis.priorityIssues`.
- A `修改路线` ordered list using `diagnosis.revisionRoute`.
- `AnnotationList` buttons named `${annotation.label}：${annotation.suggestion}`.

Clicking an annotation must update the active segment and visually highlight both the row in `ScriptSegmentList` and the source content in `ScriptSegmentDetail`.

- [ ] **Step 6: Implement segment and episode rewrites**

`RewritePanel` must expose a four-option radio group:

```tsx
const strategies = [
  { value: "CONSERVATIVE", label: "保守优化" },
  { value: "MORE_PAYOFF", label: "增强爽点" },
  { value: "MORE_EMOTION", label: "增强情绪" },
  { value: "STRONGER_TWIST", label: "加强反转" },
] as const;
```

For a selected segment, submit `projectId`, `segmentId`, and strategy to `rewriteSegment`. Display the returned revision's rewritten text under `建议版本`, show the source text directly above it, and provide an icon button named `采用为新版本` that refreshes the route after saving.

At the top of the diagnosis panel, provide an `整集重写` command. It uses the same four strategies and calls `rewriteEpisode`. Both requests must display pending controls and surface the Server Action error message without losing the current selected segment.

- [ ] **Step 7: Run workbench tests**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test -- src/components/diagnosis-panel.test.tsx src/components/rewrite-panel.test.tsx
$env:AI_PROVIDER="fixture"; npm run test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit script diagnosis**

Run:

```powershell
git add src/app/projects src/components
git commit -m "feat: add script diagnosis and rewrite workbench"
```

### Task 9: Add resilience, project management, seed data, and browser coverage

**Files:**
- Create: `prisma/seed.ts`
- Create: `src/components/action-error.tsx`
- Modify: `src/components/project-list.tsx`
- Modify: `src/components/project-header.tsx`
- Modify: `src/app/actions/projects.ts`
- Create: `e2e/create-story.spec.ts`
- Create: `e2e/diagnose-script.spec.ts`
- Create: `e2e/revision-history.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write end-to-end tests with the fixture provider**

Create `e2e/create-story.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a creator can turn an idea into a story package", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "从灵感创作" }).click();
  await page.getByLabel("一句话灵感").fill("被逐女弟子在剑冢醒来，发现自己的灵骨藏在仇人心口。");
  await page.getByLabel("单集时长").selectOption("3");
  await page.getByRole("button", { name: "生成故事骨架" }).click();

  await expect(page.getByText("一句话卖点")).toBeVisible();
  await expect(page.getByText("单集剧情大纲")).toBeVisible();
});
```

Create `e2e/diagnose-script.spec.ts`:

```ts
test("a creator can diagnose and rewrite a selected segment", async ({ page }) => {
  await page.goto("/projects/new/optimize");
  await page.getByLabel("剧本文本").fill("【山门·夜】\n沈昭跪在雨中，师尊要剥她的灵骨。");
  await page.getByLabel("单集时长").selectOption("2");
  await page.getByRole("button", { name: "开始剧本体检" }).click();

  await expect(page.getByText("优先处理")).toBeVisible();
  await page.getByLabel("增强爽点").check();
  await page.getByRole("button", { name: "改写这一段" }).click();
  await expect(page.getByText("建议版本")).toBeVisible();
});
```

Create `e2e/revision-history.spec.ts` that generates a project, performs one rewrite, restores the initial revision, and asserts there are three visible history entries.

- [ ] **Step 2: Run e2e tests to verify they fail before configuration**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test:e2e
```

Expected: FAIL until the application server, database migration, and test configuration are wired together.

- [ ] **Step 3: Configure the browser test environment**

Create or update `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      AI_PROVIDER: "fixture",
      DATABASE_URL: "file:./e2e.db",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Before each e2e run, execute a script that deletes only `prisma/e2e.db`, runs `prisma migrate deploy`, and seeds no data. Add:

```json
{
  "scripts": {
    "test:e2e": "npm run db:e2e:reset && playwright test",
    "db:e2e:reset": "node scripts/reset-e2e-db.mjs"
  }
}
```

`scripts/reset-e2e-db.mjs` must use `path.resolve("prisma/e2e.db")`, verify that resolved filename exactly equals `e2e.db` within the `prisma` directory before unlinking, then run `npx prisma migrate deploy`.

- [ ] **Step 4: Implement user-facing error and project commands**

Create `ActionError`:

```tsx
export function ActionError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="border-l-2 border-[var(--vermilion)] pl-3 text-sm text-[var(--vermilion)]">
      {message}
    </p>
  ) : null;
}
```

Use it in every async form or rewrite surface.

Add project rename from the project header and delete from the project list. Deletion requires:

```ts
if (!window.confirm("删除项目及其全部版本后无法恢复，继续吗？")) return;
```

On action failure, preserve local input and the visible current revision. On failed AI responses, do not add a revision row.

- [ ] **Step 5: Add seed data for manual evaluation**

`prisma/seed.ts` must create one `CREATE` project called `寒灯照骨` with a valid `StoryPackage`, and one `OPTIMIZE` project called `山门雨夜` with a segmented script and a valid five-dimension diagnosis. Use repository functions or the exact same validation helpers as Server Actions, never raw unvalidated JSON.

Run:

```powershell
$env:DATABASE_URL="file:./dev.db"; npm run db:seed
```

Expected: two visible projects on `/`.

- [ ] **Step 6: Run browser and full verification**

Run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test
$env:AI_PROVIDER="fixture"; npm run test:e2e
npm run lint
npm run build
```

Expected: all checks PASS. Open the app at `http://localhost:3000` and manually verify the desktop and narrow-mobile layouts: text must remain readable, the three-pane diagnosis view must stack below `1024px`, and no controls overlap.

- [ ] **Step 7: Commit resilience and acceptance coverage**

Run:

```powershell
git add prisma scripts src/components e2e playwright.config.ts package.json
git commit -m "test: cover xijiang creator workflows"
```

### Task 10: Document local operation and final acceptance

**Files:**
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write a README that starts the application**

Include exactly these local steps:

```markdown
## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`
4. Generate and migrate the database: `npm run db:generate` then `npm run db:migrate -- --name init`
5. Start the app: `npm run dev`

For deterministic tests, run:

```powershell
$env:AI_PROVIDER="fixture"; npm run test
$env:AI_PROVIDER="fixture"; npm run test:e2e
```
```

Document the two supported workflows, the four rewrite strategies, that revisions are immutable, and that the MVP does not create storyboard/image/video prompts.

- [ ] **Step 2: Run a clean local startup verification**

From a fresh `.env` copied from `.env.example`, run:

```powershell
npm install
npm run db:generate
npm run db:migrate -- --name init
$env:AI_PROVIDER="fixture"; npm run dev
```

Expected: the home page opens at `http://localhost:3000` and both creation paths are reachable. Stop the dev server only after confirming the app responds.

- [ ] **Step 3: Perform final acceptance checks**

Verify each requirement from the design specification:

- One sentence can produce a title, logline, world rules, character cards, a five-beat outline, and key scenes.
- Existing scripts receive five category scores, priority issues, a revision route, and paragraph-bound annotations.
- Segment and episode rewrites each support all four strategies.
- Failed AI calls preserve input and current revisions.
- Version restore creates a new history item instead of overwriting history.
- The UI excludes image/video generation, collaboration, billing, and generic chat.

- [ ] **Step 4: Commit operational documentation**

Run:

```powershell
git add README.md .env.example
git commit -m "docs: add xijiang local setup guide"
```

## Plan Self-Review

**Spec coverage:** The plan maps every MVP requirement to a task: idea creation (Tasks 2, 4, 5, 6, 7), existing-script diagnosis and scoring (Tasks 2, 4, 5, 8), strategy-based segment and episode rewrites (Tasks 4, 5, 8), version history and restoration (Tasks 3 and 7), preservation/error behavior (Tasks 5 and 9), tests/acceptance (Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10), and the next-stage boundary (Tasks 1 and 10).

**Placeholder scan:** No task uses `TBD`, `TODO`, “implement later”, vague testing instructions, or unspecified error handling. Environment configuration is explicit because a model identifier and API key are intentionally supplied by the project owner rather than hard-coded.

**Type consistency:** `StoryBrief`, `StoryPackage`, `ScriptSegment`, `ScriptDiagnosis`, `RevisionContent`, `RewriteStrategy`, and the `AiProvider` methods are defined once in the Data Contract and reused consistently in the persistence, action, UI, and test tasks.
