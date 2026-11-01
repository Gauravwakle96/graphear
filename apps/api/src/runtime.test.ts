import { describe, expect, it } from 'vitest';
import { runtimeConfig } from './runtime';

describe('deployment trust boundaries', () => {
  it('uses only configured origins and leaves proxy trust disabled by default', () => {
    expect(
      runtimeConfig({
        NODE_ENV: 'production',
        RENDER_EXTERNAL_URL: 'https://graphear.onrender.com',
      }),
    ).toMatchObject({ origins: ['https://graphear.onrender.com'], proxyHops: 0 });
    expect(
      runtimeConfig({
        NODE_ENV: 'production',
        APP_PUBLIC_URL: 'https://learn.example/',
        RENDER_EXTERNAL_URL: 'https://platform.example',
        ALLOWED_ORIGINS: 'https://learn.example,https://other.example',
      }),
    ).toMatchObject({ origins: ['https://learn.example', 'https://other.example'] });
  });
  it('rejects unsafe origins, missing production origins and invalid proxy topology', () => {
    for (const value of [
      'https://user:secret@example.com',
      'https://example.com/path',
      'https://example.com/#x',
      'http://example.com',
      'file:///etc/passwd',
    ])
      expect(() => runtimeConfig({ NODE_ENV: 'production', APP_PUBLIC_URL: value })).toThrow();
    expect(() => runtimeConfig({ NODE_ENV: 'production' })).toThrow();
    for (const value of ['true', '-1', '2', '0.5'])
      expect(() => runtimeConfig({ PROXY_TRUST_HOPS: value })).toThrow();
  });
  it('permits loopback smoke checks and explicit single-proxy operation', () => {
    expect(
      runtimeConfig({
        NODE_ENV: 'production',
        APP_PUBLIC_URL: 'http://127.0.0.1:3002',
        PROXY_TRUST_HOPS: '1',
      }),
    ).toMatchObject({ production: true, proxyHops: 1 });
    expect(() => runtimeConfig({ PORT: '0' })).toThrow();
  });
});
