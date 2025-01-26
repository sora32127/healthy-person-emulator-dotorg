import { describe, test, expect } from "vitest";
import { formatDate } from "./util.server";

describe("formatDate", () => {
    test("2025-01-01T00:00:00.000Zを2025-01-01 00:00に変換する", () => {
        const date = new Date("2025-01-01T00:00:00.000Z");
        expect(formatDate(date)).toBe("2025-01-01 00:00");
    });
});