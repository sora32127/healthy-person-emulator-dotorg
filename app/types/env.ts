import type { Container } from "@cloudflare/containers";

export interface CloudflareEnv {
  // Bindings
  DB: D1Database;
  PARQUET_BUCKET: R2Bucket;
  STATIC_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  // Container (Durable Object)
  AUTOMATION_CONTAINER: DurableObjectNamespace<Container<CloudflareEnv>>;
  // Queues
  SOCIAL_POST_QUEUE: Queue;
  // Secrets (set via wrangler secret put)
  HPE_SESSION_SECRET: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLIENT_URL: string;
  BASE_URL: string;
  CF_TURNSTILE_SECRET_KEY: string;
  CF_TURNSTILE_SITEKEY: string;
  GOOGLE_GENERATIVE_API_KEY: string;
  SEARCH_PARQUET_FILE_NAME: string;
  TAGS_PARQUET_FILE_NAME: string;
  CF_WORKERS_AI_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  VECTORIZE_INDEX_NAME: string;
  GOOGLE_REDIRECT_URI: string;
  GCS_PARQUET_BASE_URL: string;
  INTERNAL_API_KEY: string;
  // Automation secrets (passed to container via getEnv)
  TWITTER_CK?: string;
  TWITTER_CS?: string;
  TWITTER_AT?: string;
  TWITTER_ATS?: string;
  BLUESKY_USER?: string;
  BLUESKY_PASSWORD?: string;
  MISSKEY_TOKEN?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  BIGQUERY_CREDENTIALS?: string;
  // Automation feature flags
  ENQUEUE_ENABLED?: string;
  SEND_ENABLED?: string;
  AUTOMATION_DRY_RUN?: string;
  // Optional
  NODE_ENV?: string;
}
