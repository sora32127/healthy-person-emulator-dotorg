/**
 * D1 → GCS Parquet export.
 * Exports all tables from D1 to GCS as Parquet files.
 * BigQuery reads these directly via external tables (no load job needed).
 */

import { SignJWT, importPKCS8 } from 'jose';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { CloudflareEnv } from '../types/env';

const TABLES = [
  'dim_tags',
  'dim_posts',
  'dim_comments',
  'dim_stop_words',
  'dim_users',
  'rel_post_tags',
  'fct_post_vote_history',
  'fct_comment_vote_history',
  'fct_post_edit_history',
  'fct_aicompletion_suggestion_history',
  'fct_aicompletion_commit_history',
  'fct_user_bookmark_activity',
  'now_editing_pages',
  'social_post_jobs',
];

const GCS_BUCKET = 'hpe-d1-export';
const GCS_PREFIX = 'd1';
const BATCH_SIZE = 1000;

interface TableResult {
  table: string;
  rows: number;
  elapsed_ms: number;
  error?: string;
}

export interface ExportResult {
  tables_exported: number;
  results: TableResult[];
}

// --- GCS Authentication ---

async function getGCSAccessToken(env: CloudflareEnv): Promise<string> {
  // GCS_CREDENTIALS is a Worker secret containing the full SA key JSON
  // (Secrets Store has a 1KB limit, too small for RSA private keys)
  const creds = JSON.parse(env.GCS_CREDENTIALS ?? '{}') as {
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
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
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
    throw new Error(`OAuth2 token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// --- Parquet conversion ---

function rowsToParquet(rows: Record<string, unknown>[]): ArrayBuffer {
  if (rows.length === 0) {
    throw new Error('Cannot convert 0 rows to Parquet');
  }

  const columns = Object.keys(rows[0]);
  const columnData = columns.map((col) => ({
    name: col,
    data: rows.map((row) => row[col]),
  }));

  return parquetWriteBuffer({ columnData, codec: 'UNCOMPRESSED' });
}

// --- GCS upload ---

async function uploadToGCS(
  accessToken: string,
  bucket: string,
  objectName: string,
  data: ArrayBuffer,
): Promise<void> {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS upload failed (${res.status}): ${text}`);
  }
}

// --- D1 table read ---

async function readD1Table(db: D1Database, tableName: string): Promise<Record<string, unknown>[]> {
  let allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const result = await db
      .prepare(`SELECT * FROM ${tableName} LIMIT ${BATCH_SIZE} OFFSET ${offset}`)
      .all();

    if (!result.results || result.results.length === 0) break;
    allRows = allRows.concat(result.results);
    offset += BATCH_SIZE;

    if (result.results.length < BATCH_SIZE) break;
  }

  return allRows;
}

// --- Main export function ---

export async function exportD1ToGCS(env: CloudflareEnv): Promise<ExportResult> {
  const accessToken = await getGCSAccessToken(env);
  const results: TableResult[] = [];

  for (const table of TABLES) {
    const start = Date.now();
    try {
      const rows = await readD1Table(env.DB, table);

      if (rows.length === 0) {
        console.log(`[gcs-export] ${table}: 0 rows, uploading empty marker`);
        // Upload a minimal valid Parquet with 0 rows is complex; skip instead
        results.push({ table, rows: 0, elapsed_ms: Date.now() - start });
        continue;
      }

      const parquetBuffer = rowsToParquet(rows);
      const objectName = `${GCS_PREFIX}/${table}.parquet`;
      await uploadToGCS(accessToken, GCS_BUCKET, objectName, parquetBuffer);

      const elapsed = Date.now() - start;
      console.log(`[gcs-export] ${table}: ${rows.length} rows in ${elapsed}ms`);
      results.push({ table, rows: rows.length, elapsed_ms: elapsed });
    } catch (err) {
      const elapsed = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gcs-export] ${table} failed: ${message}`);
      results.push({ table, rows: 0, elapsed_ms: elapsed, error: message });
    }
  }

  return {
    tables_exported: results.filter((r) => !r.error && r.rows > 0).length,
    results,
  };
}
