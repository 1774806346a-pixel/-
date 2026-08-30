import type { ScreenplayVersion, StoryBible } from "../../domain/models";
import { screenplaySchema } from "../../domain/schemas/screenplay.schema";
import { canPromoteVersion, diffScreenplayVersions, type VersionDiff } from "../../domain/versioning/version-diff";

const id = () => globalThis.crypto?.randomUUID?.() ?? `version-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now = () => new Date().toISOString();

export interface VersionRepository {
  saveVersion(version: ScreenplayVersion): Promise<ScreenplayVersion>;
}

export class VersionService {
  constructor(private readonly repository: VersionRepository) {}

  async createChild(parent: ScreenplayVersion, changes: Partial<ScreenplayVersion>): Promise<ScreenplayVersion> {
    const timestamp = now();
    const candidate = screenplaySchema.parse({
      ...parent,
      ...changes,
      id: id(),
      versionNumber: parent.versionNumber + 1,
      parentVersionId: parent.id,
      sourceVersionId: parent.sourceVersionId ?? parent.id,
      status: changes.status ?? "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return this.repository.saveVersion(candidate);
  }

  diff(before: ScreenplayVersion, after: ScreenplayVersion, storyBible?: StoryBible | null): VersionDiff {
    return diffScreenplayVersions(before, after, storyBible?.lockedFacts ?? []);
  }

  async confirm(version: ScreenplayVersion, diff?: VersionDiff, confirmations: readonly string[] = []): Promise<ScreenplayVersion> {
    if (diff && !canPromoteVersion(diff, confirmations)) throw new Error("存在未确认的锁定事实变更");
    return this.createChild(version, { status: "confirmed", title: version.title });
  }

  async restore(version: ScreenplayVersion): Promise<ScreenplayVersion> {
    return this.createChild(version, { title: `${version.title} (恢复)`, status: "draft" });
  }
}
