import { Hono } from "hono";
import { html } from "hono/html";

const app = new Hono();

app.all("/test", async (c) => {
    return c.json({ message: "Hello, World!" });
}
)

export default app;