import { describe, it, expect } from 'vitest';
import { mergeVisualObservations } from './observations';
import type { Source } from '@graphear/core';

const source: Source = {
  id: 'image1',
  reference: 'Uploaded image',
  kind: 'image',
  text: '',
  page: null,
  start: null,
  end: null,
  asset: null,
};
describe('complete visual source observations', () => {
  it('retains each panel under its source ID instead of overwriting earlier panels', () => {
    const result = mergeVisualObservations(
      {
        observations: [
          {
            sourceId: 'image1',
            labels: ['Client', 'Server'],
            text: 'Left panel: all seven numbered layers.',
          },
          {
            sourceId: 'image1',
            labels: ['Client', 'Server'],
            text: 'Middle panel: headers are added then removed.',
          },
          {
            sourceId: 'image1',
            labels: ['Client', 'Server'],
            text: 'Legend: address and port fields.',
          },
          {
            sourceId: 'image1',
            labels: ['Client', 'Server'],
            text: 'Legend: address and port fields.',
          },
        ],
      },
      [source],
    );
    expect(result[0].text).toBe(
      'Left panel: all seven numbered layers.\n\nMiddle panel: headers are added then removed.\n\nLegend: address and port fields.',
    );
    expect(source.text).toBe('');
    expect(result[0].visualLabels).toEqual(['Client', 'Server']);
  });
  it('rejects unrelated IDs, omitted images and empty observations', () => {
    expect(() =>
      mergeVisualObservations(
        { observations: [{ sourceId: 'other', labels: [], text: 'Other' }] },
        [source],
      ),
    ).toThrow(/unrelated/);
    expect(() =>
      mergeVisualObservations(
        { observations: [{ sourceId: 'image1', labels: ['Client', 'Server'], text: 'First' }] },
        [source, { ...source, id: 'image2' }],
      ),
    ).toThrow(/omitted/);
    expect(() => mergeVisualObservations({ observations: [] }, [source])).toThrow();
    expect(() =>
      mergeVisualObservations(
        { observations: [{ sourceId: 'image1', labels: ['Client', 'Server'], text: ' ' }] },
        [source],
      ),
    ).toThrow();
  });
  it('rejects excess content rather than silently truncating later panels', () => {
    expect(() =>
      mergeVisualObservations(
        {
          observations: [
            { sourceId: 'image1', labels: ['Client', 'Server'], text: 'A'.repeat(9000) },
            { sourceId: 'image1', labels: ['Client', 'Server'], text: 'B'.repeat(9000) },
          ],
        },
        [source],
      ),
    ).toThrow(/Split this image/);
  });
});
