import { createCookieSessionStorage } from 'react-router';

let _sessionStorage: ReturnType<typeof createCookieSessionStorage> | null = null;

export function initSessionStorage(sessionSecret: string) {
  if (_sessionStorage) return;
  _sessionStorage = createCookieSessionStorage({
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
  if (!_sessionStorage) throw new Error('Session storage not initialized. Call initSessionStorage first.');
  return _sessionStorage;
}

export const sessionStorage = {
  getSession: (...args: Parameters<ReturnType<typeof createCookieSessionStorage>['getSession']>) =>
    ensureStorage().getSession(...args),
  commitSession: (...args: Parameters<ReturnType<typeof createCookieSessionStorage>['commitSession']>) =>
    ensureStorage().commitSession(...args),
  destroySession: (...args: Parameters<ReturnType<typeof createCookieSessionStorage>['destroySession']>) =>
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
