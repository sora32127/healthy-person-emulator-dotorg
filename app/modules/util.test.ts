import { formatDate } from "./util.server";
import { expect, it, describe } from "vitest";

describe("formatDate", () => {
    it("正常系:ISO8601形式の日付をYYYY-MM-DD HH:mm形式に変換する", () => {
        const date = new Date("2025-01-01T00:00:00.000+09:00");
        const formattedDate = formatDate(date);
        expect(formattedDate).toBe("2025-01-01 00:00");
    });
    it("正常系:ISO8601形式の日付をYYYY-MM-DD HH:mm形式に変換する", () => {
        const date = new Date("9999-01-01T00:00:00.000+09:00");
        const formattedDate = formatDate(date);
        expect(formattedDate).toBe("9999-01-01 00:00");
    });
    it("異常系:異常な日付を渡した場合はエラーを返す", () => {
        const date = new Date("-9999-01-01T00:00:00.000+09:00");
        const formattedDate = formatDate(date);
        expect(formattedDate).toBe("Invalid Date");
    });

});

