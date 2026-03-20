import type { LoaderFunctionArgs } from 'react-router';
import { requireAdmin } from '~/modules/admin.server';
import { fetchPostPVMap } from '~/modules/bigquery.server';
import type { CloudflareEnv } from '~/types/env';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const postIds =
    url.searchParams
      .get('postIds')
      ?.split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n)) ?? [];

  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const pvMap = await fetchPostPVMap(env, postIds);
  return Response.json(Object.fromEntries(pvMap));
}
