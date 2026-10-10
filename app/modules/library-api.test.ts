// @vitest-environment node
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "../routes/api.admin-library";

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

function get(postId = "1") {
  return loader({
    request: new Request(`https://example.test/api/admin-library?postId=${postId}`),
  } as LoaderFunctionArgs);
}

function post(values: Record<string, string>, origin = "https://example.test") {
  return action({
    request: new Request("https://example.test/api/admin-library", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams(values),
    }),
  } as ActionFunctionArgs);
}

describe("admin library API", () => {
  it("管理者のGET結果をprivateなJSONとして返す", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    prepare.mockImplementation((sql: string) => ({
      bind: () => ({
        first: async () => sql.startsWith("SELECT post_id") ? { post_id: 1 } : null,
      }),
    }));
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, entry: null, historyEnabled: true });
    expect(batch).not.toHaveBeenCalled();
  });

  it("管理者のPOSTフォームを読み取り履歴消去を実行する", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await post({ intent: "clearHistory" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, historyEnabled: true });
    expect(batch).toHaveBeenCalledOnce();
  });

  it.each([
    [null, 401],
    [{ email: "reader@example.test", userUuid: "reader" }, 403],
  ])("GET/POSTで管理者以外の直接アクセスを拒否し、キャッシュしない", async (user, status) => {
    auth.user = user;
    for (const response of [await get(), await post({ intent: "recordView", postId: "1" })]) {
      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({ success: false, error: expect.any(String) });
    }
    expect(prepare).not.toHaveBeenCalled();
  });

  it("管理者でもcross-origin POSTを拒否する", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await post({ intent: "clearHistory" }, "https://attacker.test");
    expect(response.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("不正な記事IDと操作は400を返す", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    expect((await get("-1")).status).toBe(400);
    expect((await post({ intent: "unknown" })).status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("存在しない記事は404を返す", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await get("99");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "記事が見つかりません" });
  });

  it("認証後のフォーム破損は400を返す", async () => {
    auth.user = { email: "admin@example.test", userUuid: "admin" };
    const response = await action({
      request: new Request("https://example.test/api/admin-library", {
        method: "POST",
        headers: { Origin: "https://example.test", "Content-Type": "application/json" },
        body: "{}",
      }),
    } as ActionFunctionArgs);
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
});
