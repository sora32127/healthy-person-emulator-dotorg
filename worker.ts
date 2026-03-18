import { createRequestHandler } from 'react-router';
import type { CloudflareEnv } from './app/types/env';

// Import the server build output
// @ts-expect-error - this is the built server output
import * as serverBuild from './build/server/index.js';

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
} satisfies ExportedHandler<CloudflareEnv>;
