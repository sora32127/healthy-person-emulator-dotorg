import { createCookieSessionStorage } from 'react-router';

interface SessionData {
  user: {
    userUuid: string;
    email: string;
    userAuthType: 'Email' | 'Google';
    photoUrl?: string;
  };
  likedPages: number[];
  dislikedPages: number[];
  likedComments: number[];
  dislikedComments: number[];
  isValidUser: boolean;
}

let _sessionStorage: ReturnType<typeof createCookieSessionStorage<SessionData>> | null = null;

export function initSessionStorage(sessionSecret: string) {
  if (_sessionStorage) return;
  _sessionStorage = createCookieSessionStorage<SessionData>({
    cookie: {
      name: '__healthy_person_emulator',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      path: '/',
      sameSite: 'lax',
      secrets: [sessionSecret],
      secure: true, // Workers are always HTTPS
    },
  });
}

function ensureStorage() {
  if (!_sessionStorage) {
    const env = (globalThis as any).__cloudflareEnv;
    if (env) {
      initSessionStorage(env.SESSION_SECRET || env.HPE_SESSION_SECRET || 's3cr3t');
    }
    if (!_sessionStorage) {
      throw new Error('Session storage not initialized and no env available.');
    }
  }
  return _sessionStorage!;
}

type TypedSessionStorage = ReturnType<typeof createCookieSessionStorage<SessionData>>;

export const sessionStorage = {
  getSession: (...args: Parameters<TypedSessionStorage['getSession']>) =>
    ensureStorage().getSession(...args),
  commitSession: (...args: Parameters<TypedSessionStorage['commitSession']>) =>
    ensureStorage().commitSession(...args),
  destroySession: (...args: Parameters<TypedSessionStorage['destroySession']>) =>
    ensureStorage().destroySession(...args),
};

export const getSession = (cookieHeader: string | null) => ensureStorage().getSession(cookieHeader);
export const commitSession = (session: any) => ensureStorage().commitSession(session);
export const destroySession = (session: any) => ensureStorage().destroySession(session);

export async function getUserActivityData(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  const likedPages = session.get('likedPages') || [];
  const dislikedPages = session.get('dislikedPages') || [];
  const likedComments = session.get('likedComments') || [];
  const dislikedComments = session.get('dislikedComments') || [];

  return { likedPages, dislikedPages, likedComments, dislikedComments };
}

export async function isUserValid(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  const isValidUser = (await session.get('isValidUser')) ?? false;
  if (isValidUser) {
    return true;
  }
  return false;
}
