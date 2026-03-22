import OAuth from 'oauth-1.0a';
import { createHmac } from 'node:crypto';
import { TYPE_PREFIX } from './types';
import type { TwitterCredentials, SocialPostResult } from './types';

export function createPostText(postTitle: string, postUrl: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `[${prefix}] : ${postTitle} 健常者エミュレータ事例集\n${postUrl}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function createOAuth(creds: TwitterCredentials): OAuth {
  return new OAuth({
    consumer: { key: creds.consumerKey, secret: creds.consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

export function getAuthHeader(
  oauth: OAuth,
  creds: TwitterCredentials,
  request: { url: string; method: string },
): string {
  const token = { key: creds.accessToken, secret: creds.accessTokenSecret };
  const authorized = oauth.authorize(request, token);
  return oauth.toHeader(authorized).Authorization;
}

async function uploadMedia(creds: TwitterCredentials, imageData: ArrayBuffer): Promise<string> {
  const oauth = createOAuth(creds);
  const formData = new FormData();
  formData.append('media_data', arrayBufferToBase64(imageData));

  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const authHeader = getAuthHeader(oauth, creds, { url, method: 'POST' });

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter media upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { media_id_string: string };
  return data.media_id_string;
}

export async function postToTwitter(
  creds: TwitterCredentials,
  params: { postTitle: string; postUrl: string; ogUrl?: string; messageType: string },
): Promise<SocialPostResult> {
  const text = createPostText(params.postTitle, params.postUrl, params.messageType);

  let mediaId: string | undefined;
  if (params.ogUrl) {
    const imageRes = await fetch(params.ogUrl);
    if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
    const imageData = await imageRes.arrayBuffer();
    mediaId = await uploadMedia(creds, imageData);
  }

  const oauth = createOAuth(creds);
  const tweetUrl = 'https://api.x.com/2/tweets';
  const tweetBody: Record<string, unknown> = { text };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }
  const body = JSON.stringify(tweetBody);
  const authHeader = getAuthHeader(oauth, creds, { url: tweetUrl, method: 'POST' });

  const res = await fetch(tweetUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitter create tweet failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return { providerPostId: data.data.id };
}

export async function tweetRaw(creds: TwitterCredentials, text: string): Promise<SocialPostResult> {
  const oauth = createOAuth(creds);
  const tweetUrl = 'https://api.x.com/2/tweets';
  const authHeader = getAuthHeader(oauth, creds, { url: tweetUrl, method: 'POST' });

  const res = await fetch(tweetUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitter create tweet failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return { providerPostId: data.data.id };
}

export async function deleteFromTwitter(creds: TwitterCredentials, tweetId: string): Promise<void> {
  const oauth = createOAuth(creds);
  const url = `https://api.x.com/2/tweets/${tweetId}`;
  const authHeader = getAuthHeader(oauth, creds, { url, method: 'DELETE' });

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter delete failed (${res.status}): ${text}`);
  }
}
