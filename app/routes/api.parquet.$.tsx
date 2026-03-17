import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ params, context }: LoaderFunctionArgs) {
  const fileName = params['*'];
  if (!fileName) return new Response('Not found', { status: 404 });

  const bucket = (context as any).cloudflare.env.PARQUET_BUCKET as R2Bucket;
  const object = await bucket.get(fileName);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
