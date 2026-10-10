// @vitest-environment node
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraryEntry, getLibraryPage, LibraryError, mutateLibrary } from "./library.server";

const auth = vi.hoisted(() => ({ user: null as null | { email: string; userUuid: string } }));
vi.mock("./auth.google.server", () => ({ getAuthenticatedUser: vi.fn(async () => auth.user) }));

const ADMIN_A = { email: "admin-a@example.test", userUuid: "admin-a" };
const ADMIN_B = { email: "admin-b@example.test", userUuid: "admin-b" };
let sqlite: InstanceType<typeof Database>;
let writes: number;
let prepares: number;

function createD1Adapter(): D1Database {
  function prepare(sql: string) {
    prepares++;
    let values: unknown[] = [];
    const statement = {
      bind(...parameters: unknown[]) {
        values = parameters;
        return statement;
      },
      async first() {
        return sqlite.prepare(sql).get(...values) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...values) };
      },
      async run() {
        writes++;
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: result.changes } };
      },
      execute() {
        writes++;
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: result.changes } };
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: { execute(): unknown }[]) {
      return sqlite.transaction(() => statements.map((statement) => statement.execute()))();
    },
  } as unknown as D1Database;
}

function request() {
  return new Request("https://example.test/api/admin-library");
}

function mutate(values: Record<string, string>, origin = "https://example.test") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return mutateLibrary(
    new Request("https://example.test/api/admin-library", {
      method: "POST",
      headers: { Origin: origin },
    }),
    formData,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00.000Z"));
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE dim_users (user_uuid TEXT PRIMARY KEY);
    CREATE TABLE dim_posts (post_id INTEGER PRIMARY KEY, post_title TEXT NOT NULL);
    INSERT INTO dim_users VALUES ('admin-a'), ('admin-b');
  `);
  sqlite.exec(
    readFileSync(
      new URL("../../drizzle/migrations/0007_add_user_library.sql", import.meta.url),
      "utf8",
    ),
  );
  const insertPost = sqlite.prepare("INSERT INTO dim_posts VALUES (?, ?)");
  sqlite.transaction(() => {
    for (let i = 1; i <= 550; i++) insertPost.run(i, i === 1 ? "会議での事例 100%" : `事例 ${i}`);
  })();
  writes = 0;
  prepares = 0;
  auth.user = ADMIN_A;
  vi.stubGlobal("__cloudflareEnv", {
    ADMIN_EMAILS: " admin-a@example.test, admin-b@example.test ",
    DB: createD1Adapter(),
  });
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("admin personal library", () => {
  it.each([
    [null, 401],
    [{ email: "regular@example.test", userUuid: "regular" }, 403],
  ])("APIの認証拒否ではD1にアクセスしない", async (user, status) => {
    auth.user = user;
    await expect(getLibraryEntry(request(), 1)).rejects.toMatchObject({ status });
    await expect(mutate({ intent: "recordView", postId: "1" })).rejects.toMatchObject({ status });
    expect(prepares).toBe(0);
  });

  it("ページ一覧も独立して管理者権限を確認する", async () => {
    auth.user = null;
    const result = await getLibraryPage(request(), { view: "saved", query: "", page: 1 }).catch(
      (error) => error,
    );
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    expect(prepares).toBe(0);
  });

  it("送信された所有者を無視し、管理者間の保存とメモを分離する", async () => {
    await mutate({ intent: "setSaved", postId: "1", isSaved: "true", userUuid: ADMIN_B.userUuid });
    await mutate({ intent: "saveNote", postId: "1", note: "自分の会議で使いたい" });
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({
      isSaved: true,
      note: "自分の会議で使いたい",
    });
    auth.user = ADMIN_B;
    expect((await getLibraryEntry(request(), 1)).entry).toBeNull();
    await mutate({ intent: "saveNote", postId: "1", note: "Bのメモ" });
    await mutate({ intent: "setSaved", postId: "1", isSaved: "false" });
    auth.user = ADMIN_A;
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({
      isSaved: true,
      note: "自分の会議で使いたい",
    });
  });

  it("GETは履歴や初期設定を書き込まない", async () => {
    expect(await getLibraryEntry(request(), 1)).toEqual({ entry: null, historyEnabled: true });
    await getLibraryPage(request(), { view: "history", query: "", page: 1 });
    expect(writes).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_settings").get()).toEqual({
      n: 0,
    });
  });

  it.each(["https://attacker.test", "null", ""])(
    "同一origin以外から書き込めない: %s",
    async (origin) => {
      await expect(
        mutate({ intent: "setSaved", postId: "1", isSaved: "true" }, origin),
      ).rejects.toMatchObject({ status: 403 });
      expect(prepares).toBe(0);
    },
  );

  it("30分以内の再閲覧ではDBに再書き込みせず、30分後に更新する", async () => {
    const first = await mutate({ intent: "recordView", postId: "1" });
    const firstWrites = writes;
    vi.setSystemTime(new Date("2026-10-10T00:29:59.000Z"));
    const second = await mutate({ intent: "recordView", postId: "1" });
    expect(writes).toBe(firstWrites);
    expect(second).toEqual(first);
    vi.setSystemTime(new Date("2026-10-10T00:30:00.000Z"));
    const third = await mutate({ intent: "recordView", postId: "1" });
    expect(third).toMatchObject({ entry: { lastViewedAt: "2026-10-10T00:30:00.000Z" } });
    expect(writes).toBeGreaterThan(firstWrites);
  });

  it("閲覧履歴を停止した管理者だけ記録を停止する", async () => {
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    const before = writes;
    expect(await mutate({ intent: "recordView", postId: "1" })).toEqual({
      success: true,
      entry: null,
      historyEnabled: false,
    });
    expect(writes).toBe(before);
    auth.user = ADMIN_B;
    expect(await mutate({ intent: "recordView", postId: "1" })).toMatchObject({
      historyEnabled: true,
    });
  });

  it("履歴を消去しても保存・メモと別管理者の履歴を保持する", async () => {
    for (const postId of ["1", "2", "3"]) await mutate({ intent: "recordView", postId });
    await mutate({ intent: "setSaved", postId: "1", isSaved: "true" });
    await mutate({ intent: "saveNote", postId: "2", note: "残したいメモ" });
    auth.user = ADMIN_B;
    await mutate({ intent: "recordView", postId: "3" });
    auth.user = ADMIN_A;
    await mutate({ intent: "clearHistory" });
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({
      isSaved: true,
      lastViewedAt: null,
    });
    expect((await getLibraryEntry(request(), 2)).entry).toMatchObject({
      note: "残したいメモ",
      lastViewedAt: null,
    });
    expect((await getLibraryEntry(request(), 3)).entry).toBeNull();
    auth.user = ADMIN_B;
    expect((await getLibraryEntry(request(), 3)).entry?.lastViewedAt).not.toBeNull();
  });

  it("90日を超えた履歴を表示せず、次の記録時に保存とメモを残して整理する", async () => {
    sqlite
      .prepare(`INSERT INTO user_library_entries VALUES ('admin-a', 1, 'メモ', 1, ?, ?)`)
      .run("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    sqlite
      .prepare(`INSERT INTO user_library_entries VALUES ('admin-a', 2, '', 0, NULL, ?)`)
      .run("2026-01-01T00:00:00.000Z");
    expect((await getLibraryPage(request(), { view: "history", query: "", page: 1 })).total).toBe(
      0,
    );
    expect((await getLibraryEntry(request(), 1)).entry?.lastViewedAt).toBeNull();
    await mutate({ intent: "recordView", postId: "3" });
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({
      note: "メモ",
      isSaved: true,
      lastViewedAt: null,
    });
    expect((await getLibraryEntry(request(), 2)).entry).toBeNull();
  });

  it("最新500件に制限し、除外された記事の保存とメモは保持する", async () => {
    const insert = sqlite.prepare(
      `INSERT INTO user_library_entries VALUES ('admin-a', ?, ?, ?, ?, ?)`,
    );
    sqlite.transaction(() => {
      for (let i = 1; i <= 501; i++) {
        insert.run(
          i,
          i === 1 ? "残す" : "",
          i === 1 ? 1 : 0,
          i === 1 ? "2026-10-09T00:00:00.000Z" : null,
          new Date(Date.parse("2026-10-09T00:00:00.000Z") + i * 1000).toISOString(),
        );
      }
    })();
    await mutate({ intent: "recordView", postId: "502" });
    const page = await getLibraryPage(request(), { view: "history", query: "", page: 1 });
    expect(page).toMatchObject({ total: 500, totalPages: 10 });
    expect(page.entries).toHaveLength(50);
    expect(page.entries[0].postId).toBe(502);
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({
      note: "残す",
      isSaved: true,
      lastViewedAt: null,
    });
    expect((await getLibraryEntry(request(), 2)).entry).toBeNull();
  });

  it("保存とメモを検索でき、SQLのワイルドカードを文字として扱う", async () => {
    await mutate({ intent: "setSaved", postId: "1", isSaved: "true" });
    await mutate({ intent: "saveNote", postId: "2", note: "聞き返す_練習" });
    await mutate({ intent: "recordView", postId: "3" });
    expect((await getLibraryPage(request(), { view: "saved", query: "", page: 1 })).total).toBe(2);
    expect(
      (await getLibraryPage(request(), { view: "saved", query: "%", page: 1 })).entries.map(
        (entry) => entry.postId,
      ),
    ).toEqual([1]);
    expect(
      (await getLibraryPage(request(), { view: "saved", query: "_", page: 1 })).entries.map(
        (entry) => entry.postId,
      ),
    ).toEqual([2]);
    expect(
      (await getLibraryPage(request(), { view: "saved", query: "会議", page: 999 })).page,
    ).toBe(1);
  });

  it("空のメモと保存解除で履歴がないエントリを残さない", async () => {
    await mutate({ intent: "setSaved", postId: "1", isSaved: "true" });
    await mutate({ intent: "saveNote", postId: "1", note: "メモ" });
    await mutate({ intent: "setSaved", postId: "1", isSaved: "false" });
    expect((await getLibraryEntry(request(), 1)).entry).toMatchObject({ note: "メモ" });
    await mutate({ intent: "saveNote", postId: "1", note: "" });
    expect((await getLibraryEntry(request(), 1)).entry).toBeNull();
  });

  it.each(["0", "-1", "1.5", "NaN", "9007199254740992", "", "1e0"])(
    "不正な記事IDを拒否する: %s",
    async (postId) => {
      await expect(getLibraryEntry(request(), postId)).rejects.toMatchObject({ status: 400 });
      await expect(mutate({ intent: "recordView", postId })).rejects.toMatchObject({ status: 400 });
      expect(writes).toBe(0);
    },
  );

  it("存在しない記事、長いメモ、不正な設定値を拒否する", async () => {
    await expect(
      mutate({ intent: "setSaved", postId: "99999", isSaved: "true" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mutate({ intent: "saveNote", postId: "1", note: "あ".repeat(2001) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(mutate({ intent: "setSaved", postId: "1", isSaved: "yes" })).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(mutate({ intent: "setHistoryEnabled", enabled: "1" })).rejects.toBeInstanceOf(
      LibraryError,
    );
    expect(writes).toBe(0);
  });

  it("記事・ユーザー削除時にFKで個人データも削除する", async () => {
    await mutate({ intent: "saveNote", postId: "1", note: "削除される" });
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    sqlite.prepare("DELETE FROM dim_posts WHERE post_id = 1").run();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_entries").get()).toEqual({
      n: 0,
    });
    await mutate({ intent: "saveNote", postId: "2", note: "削除される" });
    sqlite.prepare("DELETE FROM dim_users WHERE user_uuid = 'admin-a'").run();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_entries").get()).toEqual({
      n: 0,
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_settings").get()).toEqual({
      n: 0,
    });
    expect(() =>
      sqlite.prepare("INSERT INTO user_library_settings VALUES ('missing-user', 1)").run(),
    ).toThrow();
  });
});
