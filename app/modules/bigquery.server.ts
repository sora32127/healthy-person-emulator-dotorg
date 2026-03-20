/**
 * BigQuery REST API utility for Workers.
 * Follows the same JWT auth pattern as gcs-export.server.ts.
 */

import { SignJWT, importPKCS8 } from 'jose';
import type { CloudflareEnv } from '../types/env';

const BQ_PROJECT = 'healthy-person-emulator';
const BQ_DATASET = 'HPE_REPORTS';
const BQ_VIEW = 'vw_post_page_views';

async function getBigQueryAccessToken(env: CloudflareEnv): Promise<string> {
  const creds = JSON.parse(env.BIGQUERY_CREDENTIALS ?? '{}') as {
    client_email: string;
    private_key: string;
    private_key_id: string;
  };
  const {
    client_email: clientEmail,
    private_key: privateKeyPem,
    private_key_id: privateKeyId,
  } = creds;

  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/bigquery.readonly',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: privateKeyId })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery OAuth2 token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface BigQueryQueryResponse {
  jobComplete: boolean;
  rows?: Array<{ f: Array<{ v: string | null }> }>;
  schema?: { fields: Array<{ name: string; type: string }> };
}

export async function fetchPostPVMap(env: CloudflareEnv): Promise<Map<number, number>> {
  try {
    const accessToken = await getBigQueryAccessToken(env);

    const query = `SELECT post_id, total_page_views FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_VIEW}\``;

    const res = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${BQ_PROJECT}/queries`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          useLegacySql: false,
          maxResults: 10000,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[bigquery] Query failed (${res.status}): ${text}`);
      return new Map();
    }

    const data = (await res.json()) as BigQueryQueryResponse;

    if (!data.jobComplete || !data.rows) {
      console.error('[bigquery] Job not complete or no rows returned');
      return new Map();
    }

    const pvMap = new Map<number, number>();
    for (const row of data.rows) {
      const postId = Number(row.f[0].v);
      const totalPV = Number(row.f[1].v);
      if (!Number.isNaN(postId) && !Number.isNaN(totalPV)) {
        pvMap.set(postId, totalPV);
      }
    }

    return pvMap;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[bigquery] Failed to fetch PV data: ${message}`);
    return new Map();
  }
}
