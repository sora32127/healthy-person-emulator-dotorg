import { createClient } from "@libsql/client/web";
import { AppLoadContext } from "@remix-run/cloudflare";
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from "../../drizzle/schema";

interface Env {
    TURSO_DATABASE_URL: string;
    TURSO_AUTH_TOKEN: string;
}

function getTursoClient(serverContext: AppLoadContext){
    const env = serverContext.cloudflare.env as Env;
    const TURSO_DATABASE_URL = env.TURSO_DATABASE_URL;
    const TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN;
    const client = createClient({
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema });
    return db;
}