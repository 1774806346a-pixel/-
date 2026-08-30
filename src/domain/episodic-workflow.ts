/** A screenplay snapshot that may be carried into a later episode prompt. */
export interface EpisodeReference {
  readonly episodeNumber: number;
  readonly screenplay: string;
}

export interface EpisodeContextOptions {
  readonly episodeNumber: number;
  readonly previousEpisodes?: readonly EpisodeReference[];
  /** Optional episode numbers to include, in the order requested by the user. */
  readonly referenceEpisodeNumbers?: readonly number[];
}

export interface EpisodeContext {
  readonly episodeNumber: number;
  readonly previousEpisodes: readonly EpisodeReference[];
}

function isPriorEpisode(
  reference: EpisodeReference,
  episodeNumber: number,
): boolean {
  return (
    Number.isInteger(reference.episodeNumber) &&
    reference.episodeNumber > 0 &&
    reference.episodeNumber < episodeNumber &&
    reference.screenplay.trim().length > 0
  );
}

/**
 * Resolves the screenplay snapshots available to an episode generation.
 * Episode one never receives prior scripts; later episodes default to the
 * immediately preceding episode unless the user explicitly chooses references.
 */
export function buildEpisodeContext(
  options: EpisodeContextOptions,
): EpisodeContext {
  const episodeNumber =
    Number.isInteger(options.episodeNumber) && options.episodeNumber > 0
      ? options.episodeNumber
      : 1;
  const available = (options.previousEpisodes ?? []).filter((reference) =>
    isPriorEpisode(reference, episodeNumber),
  );
  const byEpisode = new Map<number, EpisodeReference>();
  for (const reference of available) {
    if (!byEpisode.has(reference.episodeNumber))
      byEpisode.set(reference.episodeNumber, reference);
  }

  if (episodeNumber === 1 || available.length === 0) {
    return { episodeNumber, previousEpisodes: [] };
  }

  const requested = options.referenceEpisodeNumbers;
  if (requested) {
    const seen = new Set<number>();
    const selected: EpisodeReference[] = [];
    for (const number of requested) {
      if (seen.has(number)) continue;
      seen.add(number);
      const reference = byEpisode.get(number);
      if (reference) selected.push(reference);
    }
    return { episodeNumber, previousEpisodes: selected };
  }

  const previous = byEpisode.get(episodeNumber - 1);
  return { episodeNumber, previousEpisodes: previous ? [previous] : [] };
}
