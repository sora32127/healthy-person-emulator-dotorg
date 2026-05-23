/**
 * OpenAPI 3.1.0 仕様を JSON で配信するエンドポイント。
 * `/api/openapi.json` でアクセス可能。
 */
import { openApiSpec } from '~/modules/openapi-spec';

export async function loader() {
  return new Response(JSON.stringify(openApiSpec), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
