import { createCookieSessionStorage } from 'react-router';

interface VisitorSessionData {
  redirectUrl: string;
}

let _sessionStorage: ReturnType<typeof createCookieSessionStorage<VisitorSessionData>> | null =
  null;

export function initVisitorSession() {
  if (_sessionStorage) return;
  _sessionStorage = createCookieSessionStorage<VisitorSessionData>({
    cookie: {
      name: 'visitor-cookie',
      httpOnly: true,
      maxAge: 1000 * 60 * 1, // 1 minute
      path: '/',
      sameSite: 'lax',
      secure: true, // Workers are always HTTPS
    },
  });
}

function ensureStorage() {
  if (!_sessionStorage)
    throw new Error('Visitor session storage not initialized. Call initVisitorSession first.');
  return _sessionStorage;
}

const getSession = (cookieHeader: string | null) => ensureStorage().getSession(cookieHeader);
const commitSession = (session: any) => ensureStorage().commitSession(session);
const destroySessionFn = (session: any) => ensureStorage().destroySession(session);

export async function getVisitorCookieURL(request: Request): Promise<string | undefined> {
  const cookieHeader = request.headers.get('Cookie');
  const cookie = await getSession(cookieHeader);
  return cookie.get('redirectUrl') ?? undefined;
}

export async function setVisitorCookieData(
  request: Request,
  redirectUrl: string,
): Promise<Headers> {
  const session = await getSession(request.headers.get('Cookie'));
  session.set('redirectUrl', redirectUrl);
  const cookie = await commitSession(session);
  const headers = new Headers();
  headers.append('Set-Cookie', cookie);
  return headers;
}

export async function destroyVisitorCookie(request: Request): Promise<Headers> {
  const session = await getSession(request.headers.get('Cookie'));
  const cookie = await destroySessionFn(session);
  const headers = new Headers();
  headers.append('Set-Cookie', cookie);
  return headers;
}
