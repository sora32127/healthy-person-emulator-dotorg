import { Container } from "@cloudflare/containers";
import type { CloudflareEnv } from "./app/types/env";

export class AutomationContainer extends Container<CloudflareEnv> {
  defaultPort = 8080;
  sleepAfter = "5m";

  get envVars(): Record<string, string> {
    const e = this.env;
    return {
      AUTOMATION_DRY_RUN: e.AUTOMATION_DRY_RUN ?? "false",
      TWITTER_CK: e.TWITTER_CK ?? "",
      TWITTER_CS: e.TWITTER_CS ?? "",
      TWITTER_AT: e.TWITTER_AT ?? "",
      TWITTER_ATS: e.TWITTER_ATS ?? "",
      BLUESKY_USER: e.BLUESKY_USER ?? "",
      BLUESKY_PASSWORD: e.BLUESKY_PASSWORD ?? "",
      MISSKEY_TOKEN: e.MISSKEY_TOKEN ?? "",
      R2_ENDPOINT: e.R2_ENDPOINT ?? "",
      R2_ACCESS_KEY_ID: e.R2_ACCESS_KEY_ID ?? "",
      R2_SECRET_ACCESS_KEY: e.R2_SECRET_ACCESS_KEY ?? "",
      BIGQUERY_CREDENTIALS: e.BIGQUERY_CREDENTIALS ?? "",
    };
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
