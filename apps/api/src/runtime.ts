export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  const origin = (value: string) => {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(
        'Public URLs and allowed origins must be HTTP(S) origins without credentials or paths.',
      );
    if (
      production &&
      url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error('Public production origins must use HTTPS.');
    return url.origin;
  };
  // Only operator/platform environment is trusted. Request Host headers never expand this list.
  const publicUrl = env.APP_PUBLIC_URL || env.RENDER_EXTERNAL_URL;
  const origins =
    env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(origin) ?? [];
  if (publicUrl) origins.push(origin(publicUrl));
  if (production && !origins.length)
    throw new Error('Set APP_PUBLIC_URL or ALLOWED_ORIGINS before starting production.');
  const proxyHops = Number(env.PROXY_TRUST_HOPS ?? 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 1)
    throw new Error('PROXY_TRUST_HOPS must be 0 (direct) or 1 (one verified reverse proxy).');
  return {
    port,
    production,
    origins: origins.length ? [...new Set(origins)] : undefined,
    proxyHops,
  };
}
