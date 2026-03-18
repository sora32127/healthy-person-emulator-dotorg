export interface CloudflareEnv {
  // Bindings
  DB: D1Database;
  PARQUET_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
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
  // Optional
  NODE_ENV?: string;
}
