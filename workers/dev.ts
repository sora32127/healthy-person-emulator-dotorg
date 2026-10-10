import { createRequestHandler } from 'react-router';
import type { CloudflareEnv } from '../app/types/env';
import { getLoadContext } from '../app/load-context';

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return requestHandler(
      request,
      getLoadContext({
        context: { cloudflare: { env, ctx, cf: request.cf, caches } },
      }),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
