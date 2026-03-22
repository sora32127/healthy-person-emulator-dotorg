import { TYPE_PREFIX } from './types';
import type { BlueskyCredentials, SocialPostResult } from './types';

const BASE_URL = 'https://bsky.social/xrpc';

export function createPostText(postTitle: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `【${prefix}】 : ${postTitle}`;
}

interface BlueskySession {
  did: string;
  accessJwt: string;
}

async function login(creds: BlueskyCredentials): Promise<BlueskySession> {
  const res = await fetch(`${BASE_URL}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: creds.user, password: creds.password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky login failed (${res.status}): ${text}`);
  }
  return (await res.json()) as BlueskySession;
}

async function uploadBlob(session: BlueskySession, imageData: ArrayBuffer): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'image/jpeg',
    },
    body: imageData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky blob upload failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { blob: unknown };
  return data.blob;
}

export async function postToBluesky(
  creds: BlueskyCredentials,
  params: { postTitle: string; postUrl: string; ogUrl: string; messageType: string },
): Promise<SocialPostResult> {
  const session = await login(creds);
  const text = createPostText(params.postTitle, params.messageType);

  const imageRes = await fetch(params.ogUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
  const imageData = await imageRes.arrayBuffer();

  const blob = await uploadBlob(session, imageData);

  const res = await fetch(`${BASE_URL}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: params.postUrl,
            title: params.postTitle,
            description: '',
            thumb: blob,
          },
        },
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bluesky create post failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { uri: string };
  return { providerPostId: data.uri };
}

export async function deleteFromBluesky(creds: BlueskyCredentials, postUri: string): Promise<void> {
  const session = await login(creds);

  const parts = postUri.replace('at://', '').split('/');
  const repo = parts[0];
  const collection = parts[1];
  const rkey = parts[2];

  const res = await fetch(`${BASE_URL}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repo, collection, rkey }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky delete failed (${res.status}): ${text}`);
  }
}
