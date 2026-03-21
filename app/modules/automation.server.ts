/**
 * Automation flow control — OGP generation, SNS posting, job management.
 * Orchestrates Container calls, D1 state management, and Queue messaging.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, lt } from 'drizzle-orm';
import { socialPostJobs, dimPosts } from '../drizzle/schema';
import { nowUTC } from '../drizzle/utils';
import type { CloudflareEnv } from '../types/env';
import { getContainer } from '@cloudflare/containers';

const PLATFORMS = ['twitter', 'bluesky', 'activitypub'] as const;
type Platform = (typeof PLATFORMS)[number];

interface QueueMessage {
  type: 'social_post';
  schema_version: number;
  payload: {
    job_id: string;
    post_id: number;
    platform: Platform;
    post_title: string;
    post_url: string;
    og_url: string;
    message_type: string;
  };
}

// ─── Container helpers ───────────────────────────────────────

async function resolveSecrets(env: CloudflareEnv): Promise<Record<string, string>> {
  const [
    twitterCk,
    twitterCs,
    twitterAt,
    twitterAts,
    blueskyUser,
    blueskyPassword,
    misskeyToken,
    r2Endpoint,
    r2AccessKeyId,
    r2SecretAccessKey,
    dryRun,
  ] = await Promise.all([
    env.SS_TWITTER_CK.get(),
    env.SS_TWITTER_CS.get(),
    env.SS_TWITTER_AT.get(),
    env.SS_TWITTER_ATS.get(),
    env.SS_BLUESKY_USER.get(),
    env.SS_BLUESKY_PASSWORD.get(),
    env.SS_MISSKEY_TOKEN.get(),
    env.SS_R2_ENDPOINT.get(),
    env.SS_R2_ACCESS_KEY_ID.get(),
    env.SS_R2_SECRET_ACCESS_KEY.get(),
    env.SS_AUTOMATION_DRY_RUN.get(),
  ]);
  return {
    TWITTER_CK: twitterCk,
    TWITTER_CS: twitterCs,
    TWITTER_AT: twitterAt,
    TWITTER_ATS: twitterAts,
    BLUESKY_USER: blueskyUser,
    BLUESKY_PASSWORD: blueskyPassword,
    MISSKEY_TOKEN: misskeyToken,
    R2_ENDPOINT: r2Endpoint,
    R2_ACCESS_KEY_ID: r2AccessKeyId,
    R2_SECRET_ACCESS_KEY: r2SecretAccessKey,
    AUTOMATION_DRY_RUN: dryRun,
    BIGQUERY_CREDENTIALS: env.BIGQUERY_CREDENTIALS ?? '',
  };
}

export async function callContainer(
  env: CloudflareEnv,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const container = getContainer(env.AUTOMATION_CONTAINER);

  // Pass secrets via startAndWaitForPorts
  const envVars = await resolveSecrets(env);
  await container.startAndWaitForPorts({ startOptions: { envVars } });

  const res = await container.fetch(
    new Request(`http://container${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Container ${path} returned ${res.status}: ${text}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// ─── OGP + Social Post flow ─────────────────────────────────

/**
 * Called by Cron every 10 minutes.
 * 1. Call container to generate OGP images for new posts
 * 2. For each processed post, create social_post_jobs and enqueue
 */
export interface OgpAndSocialPostResult {
  skipped: boolean;
  reason?: string;
  postsFound: number;
  jobsEnqueued: number;
}

export async function handleOgpAndSocialPost(env: CloudflareEnv): Promise<OgpAndSocialPostResult> {
  if (env.ENQUEUE_ENABLED !== 'true') {
    console.log('[automation] ENQUEUE_ENABLED is not true, skipping');
    return { skipped: true, reason: 'ENQUEUE_ENABLED is not true', postsFound: 0, jobsEnqueued: 0 };
  }

  const db = drizzle(env.DB);

  // Step 1: Call container to generate OGP
  const ogpResult = await callContainer(env, '/create-ogp', {
    api_key: env.INTERNAL_API_KEY,
  });

  const posts = (ogpResult.posts ?? []) as Array<{
    post_id: number;
    post_title: string;
    ogp_url: string;
    image_b64?: string;
    post_url: string;
  }>;

  if (posts.length === 0) {
    console.log('[automation] No new posts to process');
    return { skipped: false, postsFound: 0, jobsEnqueued: 0 };
  }

  // Step 1.5: If container couldn't upload to R2, do it from Worker
  for (const post of posts) {
    if (!post.ogp_url && post.image_b64) {
      const key = `ogp/${post.post_id}.jpg`;
      const imageBytes = Uint8Array.from(atob(post.image_b64), (c) => c.charCodeAt(0));
      await env.STATIC_BUCKET.put(key, imageBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
      });
      post.ogp_url = `https://static.healthy-person-emulator.org/${key}`;

      // Update D1
      await env.DB.prepare(`UPDATE dim_posts SET ogp_image_url = ? WHERE post_id = ?`)
        .bind(post.ogp_url, post.post_id)
        .run();

      console.log(`[automation] Worker uploaded OGP to R2: ${key}`);
    }
  }

  // Step 2: For each post, create jobs and enqueue
  let jobsEnqueued = 0;
  const now = nowUTC();
  for (const post of posts) {
    for (const platform of PLATFORMS) {
      const jobId = `${post.post_id}_${platform}`;

      // Upsert: skip if job already exists
      const existing = await db
        .select({ id: socialPostJobs.id })
        .from(socialPostJobs)
        .where(eq(socialPostJobs.id, jobId))
        .limit(1);

      if (existing.length > 0) {
        console.log(`[automation] Job ${jobId} already exists, skipping`);
        continue;
      }

      await db.insert(socialPostJobs).values({
        id: jobId,
        postId: post.post_id,
        platform,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      await enqueueAndMarkQueued(env, db, jobId, {
        post_id: post.post_id,
        platform,
        post_title: post.post_title,
        post_url: post.post_url,
        og_url: post.ogp_url,
        message_type: 'new',
      });
      jobsEnqueued++;
    }
  }

  return { skipped: false, postsFound: posts.length, jobsEnqueued };
}

/**
 * Atomically transition pending → queued and send to Queue.
 * CAS update ensures no double-enqueue.
 */
async function enqueueAndMarkQueued(
  env: CloudflareEnv,
  db: ReturnType<typeof drizzle>,
  jobId: string,
  payload: QueueMessage['payload'] extends infer T ? Omit<T, 'job_id'> : never,
): Promise<boolean> {
  const now = nowUTC();

  // CAS: only update if status is still pending
  const result = await db
    .update(socialPostJobs)
    .set({ status: 'queued', updatedAt: now })
    .where(and(eq(socialPostJobs.id, jobId), eq(socialPostJobs.status, 'pending')));

  // Check if update affected any rows
  if (!result.meta.changed_db) {
    console.log(`[automation] Job ${jobId} was not pending, skipping enqueue`);
    return false;
  }

  const message: QueueMessage = {
    type: 'social_post',
    schema_version: 1,
    payload: { ...payload, job_id: jobId },
  };

  await env.SOCIAL_POST_QUEUE.send(message);
  console.log(`[automation] Enqueued job ${jobId}`);
  return true;
}

// ─── Queue consumer ─────────────────────────────────────────

/**
 * Called by Queue consumer for each social_post message.
 * Implements idempotency check → claim → container call → update.
 */
export async function handleSocialPostConsumer(
  env: CloudflareEnv,
  payload: QueueMessage['payload'],
): Promise<{ action: 'sent' | 'skipped' | 'failed' | 'unknown' }> {
  if (env.SEND_ENABLED !== 'true') {
    console.log(`[automation] SEND_ENABLED is not true, keeping job ${payload.job_id} as queued`);
    return { action: 'skipped' };
  }

  const db = drizzle(env.DB);
  const now = nowUTC();

  // Check current status — skip if already completed or being processed
  const [job] = await db
    .select()
    .from(socialPostJobs)
    .where(eq(socialPostJobs.id, payload.job_id))
    .limit(1);

  if (!job) {
    console.warn(`[automation] Job ${payload.job_id} not found in DB`);
    return { action: 'skipped' };
  }

  if (job.status === 'sent' || job.status === 'failed') {
    console.log(`[automation] Job ${payload.job_id} already ${job.status}, skipping`);
    return { action: 'skipped' };
  }

  if (job.status === 'sending') {
    console.log(`[automation] Job ${payload.job_id} is already being processed, skipping`);
    return { action: 'skipped' };
  }

  // CAS: claim the job (queued → sending)
  const claimResult = await db
    .update(socialPostJobs)
    .set({
      status: 'sending',
      claimedAt: now,
      attemptCount: sql`${socialPostJobs.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(and(eq(socialPostJobs.id, payload.job_id), eq(socialPostJobs.status, 'queued')));

  if (!claimResult.meta.changed_db) {
    console.log(`[automation] Failed to claim job ${payload.job_id} (not in queued status)`);
    return { action: 'skipped' };
  }

  // Call container to post
  try {
    const result = await callContainer(env, '/post-social', {
      platform: payload.platform,
      post_title: payload.post_title,
      post_url: payload.post_url,
      og_url: payload.og_url,
      message_type: payload.message_type,
      post_id: payload.post_id,
    });

    // Extract provider post ID
    const providerPostId =
      (result.tweet_id as string) ??
      (result.bluesky_post_uri as string) ??
      (result.misskey_note_id as string) ??
      null;

    // Mark as sent
    await db
      .update(socialPostJobs)
      .set({
        status: 'sent',
        providerPostId,
        updatedAt: nowUTC(),
      })
      .where(eq(socialPostJobs.id, payload.job_id));

    // Also update dim_posts with the provider post ID
    if (providerPostId) {
      await updateDimPostsSocialId(db, payload.post_id, payload.platform, providerPostId);
    }

    console.log(
      `[automation] Job ${payload.job_id} sent successfully (provider_id=${providerPostId})`,
    );
    return { action: 'sent' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorType = classifyError(err);

    if (errorType === 'terminal') {
      await db
        .update(socialPostJobs)
        .set({ status: 'failed', lastError: errorMessage, updatedAt: nowUTC() })
        .where(eq(socialPostJobs.id, payload.job_id));
      console.error(`[automation] Job ${payload.job_id} permanently failed: ${errorMessage}`);
      return { action: 'failed' };
    }

    if (errorType === 'retryable') {
      // Back to queued for Queue retry
      await db
        .update(socialPostJobs)
        .set({ status: 'queued', lastError: errorMessage, updatedAt: nowUTC() })
        .where(eq(socialPostJobs.id, payload.job_id));
      console.warn(`[automation] Job ${payload.job_id} retryable error: ${errorMessage}`);
      throw err; // Let Queue retry
    }

    // ambiguous — mark as unknown
    await db
      .update(socialPostJobs)
      .set({ status: 'unknown', lastError: errorMessage, updatedAt: nowUTC() })
      .where(eq(socialPostJobs.id, payload.job_id));
    console.error(`[automation] Job ${payload.job_id} ambiguous error: ${errorMessage}`);
    return { action: 'unknown' };
  }
}

// ─── Recovery ───────────────────────────────────────────────

/**
 * Called by Cron to recover stale jobs.
 * Jobs stuck in "queued" for >10 min → reset to "pending" and re-enqueue.
 */
export interface RecoverStaleJobsResult {
  recovered: number;
}

export async function recoverStaleJobs(env: CloudflareEnv): Promise<RecoverStaleJobsResult> {
  if (env.ENQUEUE_ENABLED !== 'true') return { recovered: 0 };

  const db = drizzle(env.DB);

  // Find pending or stale queued jobs that need (re-)enqueue
  const jobsToRecover = await db
    .select()
    .from(socialPostJobs)
    .where(
      sql`${socialPostJobs.status} = 'pending' OR (${socialPostJobs.status} = 'queued' AND ${socialPostJobs.updatedAt} < ${new Date(Date.now() - 10 * 60 * 1000).toISOString()})`,
    );

  let recovered = 0;
  for (const job of jobsToRecover) {
    // If queued, reset to pending first
    if (job.status === 'queued') {
      const resetResult = await db
        .update(socialPostJobs)
        .set({ status: 'pending', updatedAt: nowUTC() })
        .where(and(eq(socialPostJobs.id, job.id), eq(socialPostJobs.status, 'queued')));
      if (!resetResult.meta.changed_db) continue;
      console.log(`[automation] Reset stale queued job ${job.id} to pending`);
    }

    // Enqueue pending job
    const [post] = await db
      .select({ postTitle: dimPosts.postTitle, ogpImageUrl: dimPosts.ogpImageUrl })
      .from(dimPosts)
      .where(eq(dimPosts.postId, job.postId))
      .limit(1);

    if (post) {
      await enqueueAndMarkQueued(env, db, job.id, {
        post_id: job.postId,
        platform: job.platform as Platform,
        post_title: post.postTitle,
        post_url: `https://healthy-person-emulator.org/archives/${job.postId}`,
        og_url: post.ogpImageUrl ?? '',
        message_type: 'new',
      });
      recovered++;
    }
  }

  return { recovered };
}

// ─── Helpers ────────────────────────────────────────────────

function classifyError(err: unknown): 'terminal' | 'retryable' | 'ambiguous' {
  const msg = err instanceof Error ? err.message : String(err);

  // Terminal: auth failures
  if (/401|403|Unauthorized|Forbidden/i.test(msg)) return 'terminal';

  // Retryable: rate limits, server errors
  if (/429|500|502|503|504|rate.?limit|timeout/i.test(msg)) return 'retryable';

  // Connection errors are ambiguous
  if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg)) return 'ambiguous';

  return 'ambiguous';
}

async function updateDimPostsSocialId(
  db: ReturnType<typeof drizzle>,
  postId: number,
  platform: Platform,
  providerPostId: string,
): Promise<void> {
  const columnMap: Record<Platform, string> = {
    twitter: 'tweet_id_of_first_tweet',
    bluesky: 'bluesky_post_uri_of_first_post',
    activitypub: 'misskey_note_id_of_first_note',
  };

  // Only update if not already set (first post only)
  await db.run(
    sql`UPDATE dim_posts SET ${sql.raw(columnMap[platform])} = ${providerPostId}, is_sns_shared = 1 WHERE post_id = ${postId} AND ${sql.raw(columnMap[platform])} IS NULL`,
  );
}
