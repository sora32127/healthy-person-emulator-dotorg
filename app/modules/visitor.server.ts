import { createCookieSessionStorage } from '@remix-run/node';

const sessionStorage = createCookieSessionStorage({
  cookie: {
      name: "visitor-cookie",
      httpOnly: true,
      maxAge: 1000 * 60 * 5, // 5 minutes
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET || "s3cr3t"],
      secure: process.env.NODE_ENV === "production",
  }
});

const { getSession, commitSession, destroySession } = sessionStorage;

export async function getVisitorCookieURL(request: Request): Promise<string> {
  const cookieHeader = request.headers.get('Cookie');
  const cookie = await getSession(cookieHeader);
  return cookie.get("redirectUrl") ?? undefined;
}

export async function setVisitorCookieData(request: Request, redirectUrl: string): Promise<string> {
  const session = await getSession(request.headers.get('Cookie'));
  session.set("redirectUrl", redirectUrl);
  const cookie = await commitSession(session);
  return cookie;
}
