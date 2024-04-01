import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { setVisitorCookieData } from "./visitor.server";

const { getSession, commitSession, destroySession } = createCookieSessionStorage({
    cookie: {
        name: "__session",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        path: "/",
        sameSite: "lax",
        secrets: [process.env.SESSION_SECRET || "s3cr3t"],
        secure: process.env.NODE_ENV === "production",
    }
});

export { getSession, commitSession, destroySession };

export async function requireUserId(request: Request){
    const session = await getSession(request.headers.get('Cookie'));
    const userId = session.get('userId');
    if (!userId || typeof userId !== 'string') {
        const headers = await setVisitorCookieData({ redirectUrl: request.url });
        throw redirect('/login', { headers });
    }
    return userId;
}
