import { defineConfig } from "vitest/config";

export default defineConfig({   
    test: {
        exclude: ["tests", "node_modules", "app/tests"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "json"],
            all: true,
            reportOnFailure: true,
        },
        environment: "happy-dom",
        testTimeout: 60000,
    }
});
