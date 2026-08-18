/**
 * SNS deletion dispatcher.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialDeleteParams } from './types';
import { deleteFromTwitter } from './twitter.server';
import { deleteFromBluesky } from './bluesky.server';
import { deleteFromMisskey } from './misskey.server';
import { deleteBufferPost } from './buffer.server';

export async function deleteFromSocial(
  env: CloudflareEnv,
  params: SocialDeleteParams,
): Promise<void> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would delete ${params.platform}: ${params.providerPostId}`);
    return;
  }

  switch (params.platform) {
    case 'twitter': {
      return deleteFromX(env, params);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return deleteFromBluesky(creds, params.providerPostId);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return deleteFromMisskey(creds, params.providerPostId);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}

/**
 * X (Twitter) 投稿削除。Buffer APIキーが設定されていれば Buffer Post ID で
 * Buffer 経由削除、なければ従来の X API 直接削除にフォールバックする。
 * ※ Buffer 経由で投稿した場合、params.providerPostId は Buffer Post ID。
 */
async function deleteFromX(env: CloudflareEnv, params: SocialDeleteParams): Promise<void> {
  // SS_BUFFER_API_KEY binding が未設定環境（テスト・一部環境）でも動くよう optional chaining で安全化
  const bufferApiKey = ((await env.SS_BUFFER_API_KEY?.get()) ?? '').trim();

  if (bufferApiKey) {
    await deleteBufferPost(bufferApiKey, params.providerPostId);
    return;
  }

  const creds = {
    consumerKey: await env.SS_TWITTER_CK.get(),
    consumerSecret: await env.SS_TWITTER_CS.get(),
    accessToken: await env.SS_TWITTER_AT.get(),
    accessTokenSecret: await env.SS_TWITTER_ATS.get(),
  };
  await deleteFromTwitter(creds, params.providerPostId);
}
