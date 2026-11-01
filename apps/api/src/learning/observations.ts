import { z } from 'zod';
import type { Source } from '@graphear/core';

export const visualObservationsSchema = z
  .object({
    observations: z
      .array(
        z
          .object({
            sourceId: z.string(),
            text: z.string().trim().min(1).max(16000),
            labels: z.array(z.string().trim().min(1).max(250)).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();

// A vision model may describe separate panels with the same source ID. Retain
// every panel; assigning each observation in turn loses all but the final one.
export function mergeVisualObservations(value: unknown, sources: Source[]) {
  const { observations } = visualObservationsSchema.parse(value);
  const expected = new Set(sources.map((s) => s.id));
  const grouped = new Map<string, Set<string>>();
  const labels = new Map<string, Set<string>>();
  for (const observation of observations) {
    if (!expected.has(observation.sourceId))
      throw new Error('Vision response referenced an unrelated source');
    const parts = grouped.get(observation.sourceId) ?? new Set<string>();
    parts.add(observation.text);
    grouped.set(observation.sourceId, parts);
    const names = labels.get(observation.sourceId) ?? new Set<string>();
    observation.labels.forEach((label) => names.add(label));
    labels.set(observation.sourceId, names);
  }
  return sources.map((source) => {
    const parts = grouped.get(source.id);
    if (!parts) throw new Error('Vision response omitted a supplied image');
    const text = [...parts].join('\n\n');
    if (text.length > 16000)
      throw new Error('Image observations exceed the source limit. Split this image into panels.');
    const visualLabels = [...(labels.get(source.id) ?? [])];
    if (visualLabels.length > 80)
      throw new Error('Image has too many essential components; split its panels.');
    return { ...source, text, visualLabels };
  });
}
