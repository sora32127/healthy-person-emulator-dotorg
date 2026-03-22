import { TYPE_PREFIX } from './types';
import type { MisskeyCredentials, SocialPostResult } from './types';

const BASE_URL = 'https://misskey.io/api';

export function createPostText(postTitle: string, postUrl: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `[${prefix}] : ${postTitle} 健常者エミュレータ事例集\n${postUrl}`;
}

async function uploadFile(creds: MisskeyCredentials, imageData: ArrayBuffer): Promise<string> {
  const formData = new FormData();
  formData.append('i', creds.token);
  formData.append('file', new Blob([imageData], { type: 'image/jpeg' }), 'og_image.jpg');

  const res = await fetch(`${BASE_URL}/drive/files/create`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Misskey file upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function postToMisskey(
  creds: MisskeyCredentials,
  params: { postTitle: string; postUrl: string; ogUrl: string; messageType: string },
): Promise<SocialPostResult> {
  const text = createPostText(params.postTitle, params.postUrl, params.messageType);

  const imageRes = await fetch(params.ogUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
  const imageData = await imageRes.arrayBuffer();

  const fileId = await uploadFile(creds, imageData);

  const res = await fetch(`${BASE_URL}/notes/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      i: creds.token,
      text,
      fileIds: [fileId],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Misskey create note failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { createdNote: { id: string } };
  return { providerPostId: data.createdNote.id };
}

export async function deleteFromMisskey(creds: MisskeyCredentials, noteId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/notes/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ i: creds.token, noteId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Misskey delete failed (${res.status}): ${text}`);
  }
}
