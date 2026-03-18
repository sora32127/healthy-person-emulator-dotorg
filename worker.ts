import { createRequestHandler } from 'react-router';
import { getContainer } from '@cloudflare/containers';
import type { CloudflareEnv } from './app/types/env';

// Import the server build output
// @ts-expect-error - this is the built server output
import * as serverBuild from './build/server/index.js';

// Re-export the Container class so wrangler can find it
export { AutomationContainer } from './container-worker';

const requestHandler = createRequestHandler(serverBuild);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    // Share env via globalThis so the build output's modules can access it.
    // worker.ts and build/server/index.js have separate module scopes,
    // but globalThis is shared within the same Workers isolate.
    (globalThis as any).__cloudflareEnv = env;

    const loadContext = {
      cloudflare: {
        env,
        ctx: {
          waitUntil: ctx.waitUntil.bind(ctx),
          passThroughOnException: ctx.passThroughOnException.bind(ctx),
        },
        cf: request.cf,
        caches,
      },
    };
    return requestHandler(request, loadContext);
  },

  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ) {
    console.log(`[scheduled] cron=${controller.cron} at ${new Date().toISOString()}`);

    // PoC: Test container startup via cron
    if (controller.cron === '*/10 * * * *') {
      try {
        const container = getContainer(env.AUTOMATION_CONTAINER);
        const res = await container.fetch(new Request('http://container/health'));
        const data = await res.json();
        console.log('[scheduled] Container health:', JSON.stringify(data));
      } catch (err) {
        console.error('[scheduled] Container call failed:', err);
      }
    }
  },

  async queue(
    batch: MessageBatch,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ) {
    const CURRENT_SCHEMA_VERSION = 1;

    for (const message of batch.messages) {
      const { type, payload, schema_version } = message.body as { type: string; payload: Record<string, unknown>; schema_version: number };
      console.log(`[queue] Processing message: type=${type}, schema_version=${schema_version}`);

      if (schema_version !== CURRENT_SCHEMA_VERSION) {
        console.warn(`[queue] Unknown schema_version=${schema_version}, sending to DLQ`);
        message.retry();
        continue;
      }

      try {
        const container = getContainer(env.AUTOMATION_CONTAINER);
        const res = await container.fetch(
          new Request('http://container/echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload }),
          }),
        );
        const data = await res.json();
        console.log(`[queue] Container response:`, JSON.stringify(data));
        message.ack();
      } catch (err) {
        console.error(`[queue] Error processing message:`, err);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
