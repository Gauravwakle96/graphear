import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const data = 'data/e2e/' + randomUUID();
const child = spawn(process.execPath, ['dist/server.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    GRAPHEAR_LOAD_ENV: '0',
    PORT: '5175',
    HOST: '127.0.0.1',
    DATABASE_PATH: data + '/graphear.sqlite',
    LEARNING_UPLOAD_DIR: data + '/uploads',
    ALLOWED_ORIGINS: 'http://127.0.0.1:5175',
    APP_PUBLIC_URL: '',
    RENDER_EXTERNAL_URL: '',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    YOUTUBE_API_KEY: '',
    YOUTUBE_OAUTH_TOKEN: '',
    PROXY_TRUST_HOPS: '0',
  },
});
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
