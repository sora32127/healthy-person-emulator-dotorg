import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";
import type { CloudflareEnv } from "./app/types/env";

export class AutomationContainer extends Container<CloudflareEnv> {
  defaultPort = 8080;
  sleepAfter = "5m";

  envVars = {
    // Feature flags
    AUTOMATION_DRY_RUN: (env as CloudflareEnv).AUTOMATION_DRY_RUN ?? "false",
    // Twitter
    TWITTER_CK: (env as CloudflareEnv).TWITTER_CK ?? "",
    TWITTER_CS: (env as CloudflareEnv).TWITTER_CS ?? "",
    TWITTER_AT: (env as CloudflareEnv).TWITTER_AT ?? "",
    TWITTER_ATS: (env as CloudflareEnv).TWITTER_ATS ?? "",
    // Bluesky
    BLUESKY_USER: (env as CloudflareEnv).BLUESKY_USER ?? "",
    BLUESKY_PASSWORD: (env as CloudflareEnv).BLUESKY_PASSWORD ?? "",
    // Misskey
    MISSKEY_TOKEN: (env as CloudflareEnv).MISSKEY_TOKEN ?? "",
    // R2 S3-compatible API
    R2_ENDPOINT: (env as CloudflareEnv).R2_ENDPOINT ?? "",
    R2_ACCESS_KEY_ID: (env as CloudflareEnv).R2_ACCESS_KEY_ID ?? "",
    R2_SECRET_ACCESS_KEY: (env as CloudflareEnv).R2_SECRET_ACCESS_KEY ?? "",
    // BigQuery
    BIGQUERY_CREDENTIALS: (env as CloudflareEnv).BIGQUERY_CREDENTIALS ?? "",
  };

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
