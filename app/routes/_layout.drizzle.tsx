import { json, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getTursoClient } from "~/modules/turso.server";

export async function loader({context}: LoaderFunctionArgs){
    const db = getTursoClient(context);
    const posts = await db.query.dimPosts.findMany({
        limit: 10
    })
    return json({ posts });
}

export default function Drizzle(){
    const { posts } = useLoaderData<typeof loader>();
    return (
        <div>
            <h1>Drizzle</h1>
            <pre>{JSON.stringify(posts, null, 2)}</pre>
        </div>
    );
}