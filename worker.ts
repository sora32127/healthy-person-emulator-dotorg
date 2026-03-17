import { createRequestHandler } from 'react-router';
import type { CloudflareEnv } from './app/types/env';
import { initializeApp } from './app/load-context';

// Import the server build output
// @ts-expect-error - this is the built server output
import * as serverBuild from './build/server/index.js';

const requestHandler = createRequestHandler(serverBuild);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    initializeApp(env);
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
