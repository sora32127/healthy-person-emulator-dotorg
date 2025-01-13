import { createCookieSessionStorage } from '@remix-run/node';

const sessionStorage = createCookieSessionStorage({
  cookie: {
      name: "visitor-cookie",
      httpOnly: true,
      maxAge: 1000 * 60 * 1, // 1 minutes
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
  }
});

const { getSession, commitSession, destroySession } = sessionStorage;

export async function getVisitorCookieURL(request: Request): Promise<string> {
  const cookieHeader = request.headers.get('Cookie');
  const cookie = await getSession(cookieHeader);
  return cookie.get("redirectUrl") ?? undefined;
}

export async function setVisitorCookieData(request: Request, redirectUrl: string): Promise<Headers> {
  const session = await getSession(request.headers.get('Cookie'));
  session.set("redirectUrl", redirectUrl);
  const cookie = await commitSession(session);
  const headers = new Headers();
  headers.append('Set-Cookie', cookie);
  return headers;
}

export async function destroyVisitorCookie(request: Request): Promise<Headers> {
  const session = await getSession(request.headers.get('Cookie'));
  const cookie = await destroySession(session);
  const headers = new Headers();
  headers.append('Set-Cookie', cookie);
  return headers;
}
