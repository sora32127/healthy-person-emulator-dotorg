import { createCookieSessionStorage, redirect } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: "__healthy_person_emulator",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        path: "/",
        sameSite: "lax",
        secrets: [process.env.SESSION_SECRET || "s3cr3t"],
        secure: process.env.NODE_ENV === "production",
    }
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export async function getUserActivityData(request: Request){
    const session = await getSession(request.headers.get('Cookie'));
    const likedPages = session.get("likedPages") || [];
    const dislikedPages = session.get("dislikedPages") || [];
    const likedComments = session.get("likedComments") || [];
    const dislikedComments = session.get("dislikedComments") || [];

    return { likedPages, dislikedPages, likedComments, dislikedComments };
}


export async function isUserValid(request: Request){
    const session = await getSession(request.headers.get('Cookie'));
    const isValidUser = await session.get("isValidUser") ?? false;
    if (isValidUser) {
        return true;
    }
    return false;
}