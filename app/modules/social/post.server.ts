/**
 * SNS posting dispatcher.
 * Routes post requests to the appropriate platform client.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialPostParams, SocialPostResult } from './types';
import { postToTwitter, createPostText } from './twitter.server';
import { postToBluesky } from './bluesky.server';
import { postToMisskey } from './misskey.server';
import { postToXViaBuffer } from './buffer.server';

export async function postToSocial(
  env: CloudflareEnv,
  params: SocialPostParams,
): Promise<SocialPostResult> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would post to ${params.platform}: ${params.postTitle}`);
    return { providerPostId: 'dry-run' };
  }

  switch (params.platform) {
    case 'twitter': {
      return postToX(env, params);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return postToBluesky(creds, params);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return postToMisskey(creds, params);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}

/**
 * X (Twitter) 投稿。Buffer APIキーが設定されていれば Buffer 経由、
 * なければ従来の X API 直接投稿にフォールバックする。
 */
async function postToX(env: CloudflareEnv, params: SocialPostParams): Promise<SocialPostResult> {
  // SS_BUFFER_API_KEY binding が未設定の環境（テスト・一部環境）でも動くよう optional chaining で安全化
  const bufferApiKey = ((await env.SS_BUFFER_API_KEY?.get()) ?? '').trim();

  if (bufferApiKey) {
    const text = createPostText(params.postTitle, params.postUrl, params.messageType);
    const { bufferPostId } = await postToXViaBuffer(bufferApiKey, {
      text,
      imageUrl: params.ogUrl || undefined,
    });
    return { providerPostId: bufferPostId, viaBuffer: true };
  }

  // フォールバック: X API 直接投稿
  const creds = {
    consumerKey: await env.SS_TWITTER_CK.get(),
    consumerSecret: await env.SS_TWITTER_CS.get(),
    accessToken: await env.SS_TWITTER_AT.get(),
    accessTokenSecret: await env.SS_TWITTER_ATS.get(),
  };
  return postToTwitter(creds, params);
}
