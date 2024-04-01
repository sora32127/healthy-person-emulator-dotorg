import { createCookieSessionStorage } from "@remix-run/node";

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