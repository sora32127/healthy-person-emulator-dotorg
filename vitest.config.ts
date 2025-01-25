import { defineConfig } from "vitest/config";
import dotenv from 'dotenv';

export default defineConfig(({ mode }: ConfigEnv) => {
    return defineConfig({   
        test: {
            exclude: ["tests", "node_modules", "app/tests"],
            coverage: {
                provider: "v8",
                reporter: ["text", "html", "json"],
                all: true,
            },
            environment: "happy-dom",
        }
    });
});