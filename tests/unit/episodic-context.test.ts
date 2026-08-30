import { describe, expect, it } from "vitest";
import { buildEpisodeContext } from "../../src/domain/episodic-workflow";

const scripts = [
  { episodeNumber: 1, screenplay: "episode one" },
  { episodeNumber: 2, screenplay: "episode two" },
  { episodeNumber: 3, screenplay: "episode three" },
] as const;

describe("episodic context", () => {
  it("does not carry prior scripts into episode one", () => {
    const context = buildEpisodeContext({
      episodeNumber: 1,
      previousEpisodes: scripts,
    });
    expect(context.previousEpisodes).toEqual([]);
  });

  it("defaults episode two to the immediately previous episode", () => {
    const context = buildEpisodeContext({
      episodeNumber: 2,
      previousEpisodes: scripts,
    });
    expect(context.previousEpisodes).toEqual([scripts[0]]);
  });

  it("keeps custom references ordered and removes duplicate episode numbers", () => {
    const context = buildEpisodeContext({
      episodeNumber: 4,
      previousEpisodes: scripts,
      referenceEpisodeNumbers: [3, 1, 3, 2],
    });
    expect(context.previousEpisodes).toEqual([
      scripts[2],
      scripts[0],
      scripts[1],
    ]);
  });
});
