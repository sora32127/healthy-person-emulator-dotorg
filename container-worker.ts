import { Container } from "@cloudflare/containers";
import type { CloudflareEnv } from "./app/types/env";

export class AutomationContainer extends Container<CloudflareEnv> {
  defaultPort = 8080;
  sleepAfter = "5m";

  getEnv(): Record<string, string> {
    const env = this.env;
    const vars: Record<string, string> = {};

    // Feature flags
    if (env.AUTOMATION_DRY_RUN) vars.AUTOMATION_DRY_RUN = env.AUTOMATION_DRY_RUN;

    // Twitter
    if (env.TWITTER_CK) vars.TWITTER_CK = env.TWITTER_CK;
    if (env.TWITTER_CS) vars.TWITTER_CS = env.TWITTER_CS;
    if (env.TWITTER_AT) vars.TWITTER_AT = env.TWITTER_AT;
    if (env.TWITTER_ATS) vars.TWITTER_ATS = env.TWITTER_ATS;

    // Bluesky
    if (env.BLUESKY_USER) vars.BLUESKY_USER = env.BLUESKY_USER;
    if (env.BLUESKY_PASSWORD) vars.BLUESKY_PASSWORD = env.BLUESKY_PASSWORD;

    // Misskey
    if (env.MISSKEY_TOKEN) vars.MISSKEY_TOKEN = env.MISSKEY_TOKEN;

    // R2 S3-compatible API
    if (env.R2_ENDPOINT) vars.R2_ENDPOINT = env.R2_ENDPOINT;
    if (env.R2_ACCESS_KEY_ID) vars.R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
    if (env.R2_SECRET_ACCESS_KEY) vars.R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;

    // BigQuery
    if (env.BIGQUERY_CREDENTIALS) vars.BIGQUERY_CREDENTIALS = env.BIGQUERY_CREDENTIALS;

    return vars;
  }

  override onStart(): void {
    console.log("[AutomationContainer] Container started");
  }

  override onStop(): void {
    console.log("[AutomationContainer] Container stopped");
  }

  override onError(error: unknown): void {
    console.error("[AutomationContainer] Container error:", error);
  }
}
