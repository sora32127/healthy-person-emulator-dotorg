import { createRequestHandler } from 'react-router';
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
    const { handleOgpAndSocialPost, recoverStaleJobs } = await import(
      './app/modules/automation.server'
    );

    console.log(`[scheduled] cron=${controller.cron} at ${new Date().toISOString()}`);

    if (controller.cron === '*/10 * * * *') {
      try {
        await handleOgpAndSocialPost(env);
        await recoverStaleJobs(env);
      } catch (err) {
        console.error('[scheduled] OGP/social post flow failed:', err);
      }
    }

    if (controller.cron === '0 12 * * *') {
      try {
        const { callContainer } = await import('./app/modules/automation.server');
        await callContainer(env, '/report-legendary', { api_key: env.INTERNAL_API_KEY });
        console.log('[scheduled] Legendary article report completed');
      } catch (err) {
        console.error('[scheduled] Legendary article report failed:', err);
      }
    }
  },

  async queue(
    batch: MessageBatch,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ) {
    const { handleSocialPostConsumer } = await import(
      './app/modules/automation.server'
    );
    const CURRENT_SCHEMA_VERSION = 1;

    for (const message of batch.messages) {
      const body = message.body as {
        type: string;
        schema_version: number;
        payload: {
          job_id: string;
          post_id: number;
          platform: string;
          post_title: string;
          post_url: string;
          og_url: string;
          message_type: string;
        };
      };

      console.log(
        `[queue] Processing: type=${body.type}, schema_version=${body.schema_version}, job=${body.payload?.job_id}`,
      );

      if (body.schema_version !== CURRENT_SCHEMA_VERSION) {
        console.warn(`[queue] Unknown schema_version=${body.schema_version}, sending to DLQ`);
        message.retry();
        continue;
      }

      if (body.type !== 'social_post') {
        console.warn(`[queue] Unknown message type=${body.type}, acking`);
        message.ack();
        continue;
      }

      // If SEND_ENABLED is false, don't consume — leave in queue without
      // consuming retries, DLQ, or attempt_count.
      if (env.SEND_ENABLED !== 'true') {
        console.log('[queue] SEND_ENABLED is not true, retrying later');
        message.retry();
        continue;
      }

      try {
        const result = await handleSocialPostConsumer(env, body.payload as Parameters<typeof handleSocialPostConsumer>[1]);

        if (result.action === 'sent' || result.action === 'skipped') {
          message.ack();
        } else if (result.action === 'unknown') {
          // Ambiguous — ack to prevent retry (status is already "unknown" in DB)
          message.ack();
        } else {
          // failed — ack (terminal error, no retry)
          message.ack();
        }
      } catch (err) {
        // Retryable error — let Queue retry
        console.error(`[queue] Retryable error for job ${body.payload.job_id}:`, err);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
