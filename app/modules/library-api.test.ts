// @vitest-environment node
import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { action } from "../routes/api.library";

const auth = vi.hoisted(() => ({ user: null as null | { email: string; userUuid: string } }));
vi.mock("~/modules/auth.google.server", () => ({
  getAuthenticatedUser: vi.fn(async () => auth.user),
}));
let prepare: ReturnType<typeof vi.fn>;
let batch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auth.user = null;
  prepare = vi.fn(() => ({ bind: () => ({ first: async () => null }) }));
  batch = vi.fn(async () => []);
  vi.stubGlobal("__cloudflareEnv", { ADMIN_EMAILS: "admin@example.test", DB: { prepare, batch } });
});
afterEach(() => vi.unstubAllGlobals());

function post(values: Record<string, string | string[]>, origin = "https://example.test") {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
  }
  return action({
    request: new Request("https://example.test/api/library", {
      method: "POST",
      headers: { Origin: origin },
      body,
    }),
  } as ActionFunctionArgs);
}

describe("library API", () => {
  it("管理者のPOSTフォームを読み取り履歴消去を実行する", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await post({ intent: "clearHistory" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true });
    expect(batch).toHaveBeenCalledOnce();
  });

  it.each([[51, 2], [500, 16]])("記事にまとめた%d件の記録を少ないクエリで選択消去できる", async (count, queries) => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const entries = Array.from({ length: count }, (_, index) => JSON.stringify({
      kind: "view",
      targetId: index + 1,
      occurredAt: "2026-10-10T00:00:00.000Z",
    }));
    const response = await post({ intent: "clearEntries", entries });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true });
    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0][0]).toHaveLength(queries);
  });

  it("保持上限500件を超えた選択消去は書き込まず拒否する", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const entry = JSON.stringify({
      kind: "view",
      targetId: 1,
      occurredAt: "2026-10-10T00:00:00.000Z",
    });
    const response = await post({ intent: "clearEntries", entries: Array(501).fill(entry) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it.each([
    [null, 401],
    [{ email: "reader@example.test", userUuid: "reader" }, 403],
  ])("管理者以外の直接アクセスを拒否し、キャッシュしない", async (user, status) => {
    auth.user = user;
    const response = await post({ intent: "recordView", postId: "1" });
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ success: false, error: expect.any(String) });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("管理者でもcross-origin POSTを拒否する", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await post({ intent: "clearHistory" }, "https://attacker.test");
    expect(response.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });
});
