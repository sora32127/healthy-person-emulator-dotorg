import type { CloudflareEnv } from './types/env';
import { initSessionStorage } from './modules/session.server';
import { initAuth } from './modules/auth.google.server';
import { initSecurity } from './modules/security.server';
import { initCloudflare } from './modules/cloudflare.server';
import { initVisitorSession } from './modules/visitor.server';
import { initDb } from './modules/db.server';
import { initGcloud } from './modules/gcloud.server';
import type { AppLoadContext } from 'react-router';
import type { PlatformProxy } from 'wrangler';

type Cloudflare = Omit<PlatformProxy<CloudflareEnv>, 'dispose'>;

declare module 'react-router' {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}

let _initialized = false;

export function initializeApp(env: CloudflareEnv) {
  if (_initialized) return;
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
    GOOGLE_GENERATIVE_API_KEY: env.GOOGLE_GENERATIVE_API_KEY,
    NODE_ENV: env.NODE_ENV,
  });
  initCloudflare({
    CF_WORKERS_AI_TOKEN: env.CF_WORKERS_AI_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    VECTORIZE_INDEX_NAME: env.VECTORIZE_INDEX_NAME,
  });
  initDb(env.DB);
  initGcloud(env.GCS_PARQUET_BASE_URL || '');
  _initialized = true;
}

export function getLoadContext({ context }: { context: { cloudflare: Cloudflare } }): AppLoadContext {
  initializeApp(context.cloudflare.env);
  return context;
}
