import type { LockedFact, ScreenplayVersion, StoryBible } from '../../domain/models';

const idFor = (projectId: string, suffix: string) => `${projectId}:bible:${suffix}`;

/** Builds the stable story-bible snapshot used by downstream asset and shot generation. */
export function extractStoryBible(screenplay: ScreenplayVersion): StoryBible {
  if (screenplay.status !== 'confirmed') {
    throw new Error('只有已确认的剧本版本才能创建故事圣经');
  }
  const now = new Date().toISOString();
  const lockedFacts: LockedFact[] = [];
  screenplay.characters.forEach((character, index) => {
    lockedFacts.push({ id: idFor(screenplay.projectId, `person-${index + 1}`), category: 'person', value: `${character.name}：${character.identity}；${character.appearance}；${character.personality}`, sourceLocation: `characters[${index}]`, locked: true });
  });
  screenplay.scenes.forEach((scene, index) => {
    lockedFacts.push({ id: idFor(screenplay.projectId, `timeline-${index + 1}`), category: 'timeline', value: `${scene.header.location} / ${scene.header.timeOfDay}`, sourceLocation: `scenes[${index}].header`, locked: true });
  });
  lockedFacts.push({ id: idFor(screenplay.projectId, 'plot'), category: 'plot', value: screenplay.metadata.oneLineSynopsis, sourceLocation: 'metadata.oneLineSynopsis', locked: true });
  const timeline = screenplay.scenes.map((scene) => `${scene.sequence}. ${scene.header.location}（${scene.header.timeOfDay}）${scene.heading ? `：${scene.heading}` : ''}`);
  return { id: idFor(screenplay.projectId, screenplay.id), projectId: screenplay.projectId, schemaVersion: 1, characters: screenplay.characters.map((character) => ({ ...character, locked: true })), assets: [], lockedFacts, timeline, createdAt: now, updatedAt: now };
}

export class StoryBibleService {
  extract(screenplay: ScreenplayVersion): StoryBible { return extractStoryBible(screenplay); }
}
