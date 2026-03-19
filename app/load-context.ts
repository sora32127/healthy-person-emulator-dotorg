import type { CloudflareEnv } from './types/env';
import { initSessionStorage } from './modules/session.server';
import { initAuth } from './modules/auth.google.server';
import { initSecurity } from './modules/security.server';
import { initCloudflare } from './modules/cloudflare.server';
import { initVisitorSession } from './modules/visitor.server';
import { initDb } from './modules/db.server';
import type { AppLoadContext } from 'react-router';
type Cloudflare = {
  env: CloudflareEnv;
  ctx: {
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
  };
  cf: Request['cf'];
  caches: typeof caches;
};

declare module 'react-router' {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}

let _initialized = false;

/**
 * Get env from globalThis (set by worker.ts) or from parameter.
 * worker.ts and build/server/index.js have separate module scopes,
 * so globalThis is used to bridge them.
 */
function resolveEnv(env?: CloudflareEnv): CloudflareEnv {
  if (env) return env;
  const globalEnv = (globalThis as any).__cloudflareEnv;
  if (globalEnv) return globalEnv;
  throw new Error('CloudflareEnv not available');
}

export function initializeApp(envParam?: CloudflareEnv) {
  if (_initialized) return;
  const env = resolveEnv(envParam);
  initSessionStorage(env.SESSION_SECRET || env.HPE_SESSION_SECRET || 's3cr3t');
  initVisitorSession();
  initAuth({
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    CLIENT_URL: env.CLIENT_URL,
    HPE_SESSION_SECRET: env.HPE_SESSION_SECRET,
  });
  initSecurity({
    CF_TURNSTILE_SECRET_KEY: env.CF_TURNSTILE_SECRET_KEY,
    CF_TURNSTILE_SITEKEY: env.CF_TURNSTILE_SITEKEY,
    AI: env.AI,
    NODE_ENV: env.NODE_ENV,
  });
  initCloudflare({
    CF_WORKERS_AI_TOKEN: env.CF_WORKERS_AI_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    VECTORIZE_INDEX_NAME: env.VECTORIZE_INDEX_NAME,
  });
  initDb(env.DB);
  _initialized = true;
}

export function getLoadContext({ context }: { context: { cloudflare: Cloudflare } }): AppLoadContext {
  initializeApp(context.cloudflare.env);
  return context;
}
