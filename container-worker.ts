import { Container } from "@cloudflare/containers";
import type { CloudflareEnv } from "./app/types/env";

export class AutomationContainer extends Container<CloudflareEnv> {
  defaultPort = 8080;
  sleepAfter = "5m";

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
