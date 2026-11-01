import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Store } from '../store';
import { LearningStore } from './store';
import { LearningService } from './service';
import { aiConfig } from '../ai/config';
import type { Generation, AIProvider } from '../ai/providers';
import { testAnalysis } from '../../../../packages/core/src/study.test-support';

it('processes a supported public URL into cited notes, diagrams and practice with two provider stages', async () => {
  const base = new Store(':memory:'),
    store = new LearningStore(base),
    owner = randomUUID();
  base.createSession(owner, randomUUID());
  const requests: Generation[] = [];
  const provider: AIProvider = {
    name: 'test-only',
    youtubeSupported: true,
    async generate(r) {
      requests.push(r);
      if (r.name === 'youtube_observations')
        return {
          available: true,
          durationSeconds: 60,
          sections: [
            {
              start: 0,
              end: 60,
              text: 'A client sends a request to the server and receives a response.',
              orders: [],
            },
          ],
          warnings: [],
        };
      return JSON.parse(JSON.stringify(testAnalysis()).replaceAll('text0', 'video0'));
    },
    async transcribe() {
      throw new Error('No transcription upload should be required');
    },
  };
  const service = new LearningService(
    store,
    { ...aiConfig(), provider: 'gemini', geminiKey: 'test-only', youtubeSeconds: 120 },
    provider,
  );
  const session = store.create(
    owner,
    {
      kind: 'youtube',
      name: 'Public educational source',
      mime: null,
      path: null,
      text: '',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      videoId: 'abcdefghijk',
      duration: 60,
      embed: true,
    },
    {
      consent: true,
      subject: 'Networks',
      questionCount: 1,
      noteStyle: 'detailed',
      difficulty: 'medium',
    },
    1,
    true,
  );
  service.start();
  try {
    let current = session;
    const deadline = Date.now() + 5000;
    while (!['completed', 'failed'].includes(current.status) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      current = store.get(owner, session.id)!;
    }
    expect(current.error).toBeNull();
    expect(current.status).toBe('completed');
    expect(requests.map((r) => r.name)).toEqual(['youtube_observations', 'study_analysis']);
    expect(requests[0].videos).toEqual([
      { url: session.input.url, startSeconds: 0, endSeconds: 60 },
    ]);
    expect(requests[1].videos).toBeUndefined();
    expect(current.input.duration).toBe(60);
    expect(current.sources[0].reference).toBe('0:00–1:00');
    expect(current.analysis!.questions[0].evidence).toEqual(['video0']);
    expect(current.analysis!.warnings.join(' ')).toContain('not retrieved as official captions');
  } finally {
    await service.stop();
    base.close();
  }
});

it.each([true, false])(
  'focuses missing video notes and diagram corrections, and revalidates corrected content (%s)',
  async (validCorrection) => {
    const base = new Store(':memory:'),
      store = new LearningStore(base),
      owner = randomUUID();
    base.createSession(owner, randomUUID());
    const requests: Generation[] = [];
    const provider: AIProvider = {
      name: 'test-only',
      youtubeSupported: true,
      async generate(r) {
        requests.push(r);
        if (r.name === 'youtube_observations')
          return {
            available: true,
            durationSeconds: 60,
            sections: [
              {
                start: 0,
                end: 60,
                text: 'A client communicates with a server through a router.',
                concepts: ['Client', 'Server', 'Router'],
                relationships: [],
                orders: [],
              },
            ],
            warnings: [],
          };
        if (r.name === 'study_notes')
          return {
            detailed: [
              {
                heading: 'Complete synthetic teaching',
                items: [
                  {
                    text: validCorrection
                      ? 'Client, Server and Router communicate.'
                      : 'Client and Server communicate.',
                    origin: 'source',
                    evidence: ['video0'],
                  },
                ],
              },
            ],
          };
        if (r.name === 'study_note_additions')
          return {
            items: [
              { text: 'Client and Server communicate.', origin: 'source', evidence: ['video0'] },
            ],
          };
        if (r.name === 'source_diagram')
          return {
            title: 'Synthetic network',
            kind: 'network',
            description: 'Test-only correction.',
            details: [],
            connections: [
              {
                source: 'Client',
                target: 'Router',
                label: 'request',
                relation: 'connection',
                direction: 'forward',
              },
              {
                source: 'Router',
                target: 'Server',
                label: 'request',
                relation: 'connection',
                direction: 'forward',
              },
            ],
            warnings: [],
          };
        return JSON.parse(JSON.stringify(testAnalysis()).replaceAll('text0', 'video0'));
      },
      async transcribe() {
        throw new Error('No recording download is needed');
      },
    };
    const service = new LearningService(
      store,
      { ...aiConfig(), provider: 'gemini', geminiKey: 'test-only', geminiRepairInvalidJSON: true },
      provider,
    );
    const session = store.create(
      owner,
      {
        kind: 'youtube',
        name: 'Test-only public video',
        mime: null,
        path: null,
        text: '',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        videoId: 'abcdefghijk',
        duration: 60,
        embed: true,
      },
      {
        consent: true,
        subject: 'Networks',
        questionCount: 1,
        noteStyle: 'detailed',
        difficulty: 'medium',
      },
      1,
      true,
    );
    service.start();
    try {
      let current = session;
      const deadline = Date.now() + 5000;
      while (!['completed', 'failed'].includes(current.status) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
        current = store.get(owner, session.id)!;
      }
      if (validCorrection) {
        expect(current.status).toBe('completed');
        expect(requests.map((r) => r.name)).toEqual([
          'youtube_observations',
          'study_analysis',
          'study_notes',
          'source_diagram',
        ]);
        expect(current.analysis!.diagrams[0].nodes).toHaveLength(3);
        expect(current.analysis!.diagrams[0].edges).toHaveLength(2);
        expect(
          current.analysis!.diagrams[0].nodes.every((n) => n.evidence.includes('video0')),
        ).toBe(true);
      } else {
        expect(current.status).toBe('failed');
        expect(current.analysis).toBeNull();
        expect(current.error).toContain('Router');
        expect(requests.map((r) => r.name)).toEqual([
          'youtube_observations',
          'study_analysis',
          'study_notes',
          'study_note_additions',
        ]);
      }
    } finally {
      await service.stop();
      base.close();
    }
  },
);
