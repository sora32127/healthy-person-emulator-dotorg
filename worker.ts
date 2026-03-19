import { createRequestHandler } from 'react-router';
import type { CloudflareEnv } from './app/types/env';

// Import the server build output
import type { ServerBuild } from 'react-router';
// @ts-ignore - this is the built server output
import * as serverBuild from './build/server/index.js';

// Re-export the Container class so wrangler can find it
export { AutomationContainer } from './container-worker';

const requestHandler = createRequestHandler(serverBuild as unknown as ServerBuild);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
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

  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    console.log(`[scheduled] cron=${controller.cron} at ${new Date().toISOString()}`);

    if (controller.cron === '*/10 * * * *') {
      ctx.waitUntil(
        (async () => {
          try {
            const { handleOgpAndSocialPost, recoverStaleJobs } =
              await import('./app/modules/automation.server');
            await handleOgpAndSocialPost(env);
            await recoverStaleJobs(env);
          } catch (err) {
            console.error('[scheduled] OGP/social post flow failed:', err);
          }
        })(),
      );
    }

    if (controller.cron === '0 12 * * *') {
      ctx.waitUntil(
        (async () => {
          try {
            const { callContainer } = await import('./app/modules/automation.server');
            await callContainer(env, '/report-legendary', { api_key: env.INTERNAL_API_KEY });
          } catch (err) {
            console.error('[scheduled] Legendary article report failed:', err);
          }
        })(),
      );
    }

    if (controller.cron === '0 12 * * 1') {
      ctx.waitUntil(
        (async () => {
          try {
            const { callContainer } = await import('./app/modules/automation.server');
            await callContainer(env, '/report-weekly', {});
          } catch (err) {
            console.error('[scheduled] Weekly summary report failed:', err);
          }
        })(),
      );
    }

    if (controller.cron === '0 16 * * *') {
      ctx.waitUntil(
        (async () => {
          try {
            const { exportD1ToGCS } = await import('./app/modules/gcs-export.server');
            const result = await exportD1ToGCS(env);
            console.log(`[scheduled] GCS export complete: ${result.tables_exported} tables`);
          } catch (err) {
            console.error('[scheduled] GCS export failed:', err);
          }
        })(),
      );
    }
  },

  async queue(batch: MessageBatch, env: CloudflareEnv, ctx: ExecutionContext) {
    const { handleSocialPostConsumer } = await import('./app/modules/automation.server');
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

      if (body.schema_version !== CURRENT_SCHEMA_VERSION) {
        message.retry();
        continue;
      }

      if (body.type !== 'social_post') {
        message.ack();
        continue;
      }

      if (env.SEND_ENABLED !== 'true') {
        message.retry();
        continue;
      }

      try {
        const result = await handleSocialPostConsumer(
          env,
          body.payload as Parameters<typeof handleSocialPostConsumer>[1],
        );
        if (
          result.action === 'sent' ||
          result.action === 'skipped' ||
          result.action === 'unknown' ||
          result.action === 'failed'
        ) {
          message.ack();
        }
      } catch (err) {
        console.error(`[queue] Retryable error for job ${body.payload.job_id}:`, err);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
