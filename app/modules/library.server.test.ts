// @vitest-environment node
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLibraryEntry,
  getLibraryPage,
  LibraryError,
  mutateLibrary,
  recordLibraryReaction,
} from "./library.server";

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

function migration(name: string) {
  return readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
}
function request() {
  return new Request("https://example.test/api/library");
}
function postRequest(origin = "https://example.test") {
  return new Request("https://example.test/archives/1", {
    method: "POST",
    headers: { Origin: origin },
  });
}
function mutate(values: Record<string, string>, origin = "https://example.test") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return mutateLibrary(postRequest(origin), formData);
}
function react(postId: number, voteType: "like" | "dislike", commentId?: number) {
  return recordLibraryReaction(postRequest(), { postId, voteType, commentId });
}
function page(query = "", pageNumber = 1) {
  return getLibraryPage(request(), { query, page: pageNumber });
}
function legacyEntry(postId = 1, lastViewedAt: string | null = null) {
  sqlite
    .prepare(
      `INSERT INTO user_library_entries
       (user_uuid, post_id, note, is_saved, saved_at, note_updated_at, last_viewed_at)
       VALUES (?, ?, '旧メモの限定キーワード', 1, ?, ?, ?)`,
    )
    .run(
      ADMIN_A.userUuid,
      postId,
      "2026-10-08T00:00:00.000Z",
      "2026-10-09T00:00:00.000Z",
      lastViewedAt,
    );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00.000Z"));
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE dim_users (user_uuid TEXT PRIMARY KEY);
    CREATE TABLE dim_posts (post_id INTEGER PRIMARY KEY, post_title TEXT NOT NULL, post_content TEXT NOT NULL);
    CREATE TABLE dim_comments (comment_id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES dim_posts(post_id) ON DELETE CASCADE, comment_content TEXT NOT NULL);
    CREATE TABLE dim_tags (tag_id INTEGER PRIMARY KEY, tag_name TEXT NOT NULL);
    CREATE TABLE rel_post_tags (post_id INTEGER NOT NULL REFERENCES dim_posts(post_id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES dim_tags(tag_id) ON DELETE CASCADE, PRIMARY KEY(post_id, tag_id));
    INSERT INTO dim_users VALUES ('admin-a'), ('admin-b');
  `);
  sqlite.exec(migration("0007_add_user_library.sql"));
  sqlite.exec(migration("0008_add_library_note_timestamp.sql"));
  sqlite.exec(migration("0009_add_library_reactions.sql"));
  const insertPost = sqlite.prepare("INSERT INTO dim_posts VALUES (?, ?, ?)");
  sqlite.transaction(() => {
    for (let i = 1; i <= 550; i++) {
      insertPost.run(
        i,
        i === 1 ? "会議での事例 100%" : `事例 ${i}`,
        i === 2 ? "本文だけに含まれる相談の事例" : "本文",
      );
    }
  })();
  sqlite.exec(
    "INSERT INTO dim_comments VALUES (1, 1, '聞き返す_練習'), (2, 1, '別コメント'), (3, 2, 'コメントの限定キーワード');",
  );
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

describe("personal history", () => {
  it("反応履歴の移行は繰り返せて、既存の保存・メモ・閲覧日時を変更しない", () => {
    legacyEntry(1, "2026-10-09T01:00:00.000Z");
    const before = sqlite.prepare("SELECT * FROM user_library_entries").get();
    sqlite.exec(migration("0009_add_library_reactions.sql"));
    sqlite.exec(migration("0009_add_library_reactions.sql"));
    expect(sqlite.prepare("SELECT * FROM user_library_entries").get()).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_reactions").get()).toEqual({
      n: 0,
    });
  });

  it.each([
    [null, 401],
    [{ email: "regular@example.test", userUuid: "regular" }, 403],
  ])("APIの認証拒否ではD1にアクセスしない", async (user, status) => {
    auth.user = user;
    await expect(getLibraryEntry(request(), 1)).rejects.toMatchObject({ status });
    await expect(mutate({ intent: "recordView", postId: "1" })).rejects.toMatchObject({ status });
    expect(prepares).toBe(0);
  });

  it.each([null, { email: "regular@example.test", userUuid: "regular" }])(
    "ページ一覧も独立して公開対象を確認する",
    async (user) => {
      auth.user = user;
      const result = await page().catch((error) => error);
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/");
      expect(prepares).toBe(0);
    },
  );

  it.each([null, { email: "regular@example.test", userUuid: "regular" }])(
    "一般・匿名ユーザーの既存評価に履歴用D1処理を追加しない",
    async (user) => {
      auth.user = user;
      await react(1, "like");
      await react(1, "dislike", 1);
      expect(prepares).toBe(0);
      expect(writes).toBe(0);
    },
  );

  it("公開対象から外れたセッションは既存履歴に触れない", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    const before = writes;
    (globalThis as any).__cloudflareEnv.ADMIN_EMAILS = "";
    prepares = 0;
    await expect(getLibraryEntry(request(), 1)).rejects.toMatchObject({ status: 403 });
    await expect(mutate({ intent: "recordView", postId: "1" })).rejects.toMatchObject({
      status: 403,
    });
    expect((await page().catch((error) => error)).status).toBe(302);
    await react(2, "like");
    expect(prepares).toBe(0);
    expect(writes).toBe(before);
  });

  it("送信された所有者を無視し、管理者間の閲覧と評価を分離する", async () => {
    await mutate({ intent: "recordView", postId: "1", userUuid: ADMIN_B.userUuid });
    await react(1, "like", 1);
    auth.user = ADMIN_B;
    expect((await getLibraryEntry(request(), 1)).entry).toBeNull();
    expect((await page()).total).toBe(0);
    await react(2, "dislike");
    auth.user = ADMIN_A;
    expect((await page()).entries.map(({ postId, kind }) => [postId, kind])).toEqual([
      [1, "view"],
      [1, "comment_like"],
    ]);
  });

  it("既存保存・メモは物理保持し、API・一覧・検索に露出しない", async () => {
    legacyEntry();
    const before = sqlite.prepare("SELECT * FROM user_library_entries").get();
    expect(await getLibraryEntry(request(), 1)).toEqual({ entry: null, historyEnabled: true });
    expect((await page()).total).toBe(0);
    await mutate({ intent: "recordView", postId: "1" });
    expect((await getLibraryEntry(request(), 1)).entry).toEqual({
      postId: 1,
      postTitle: "会議での事例 100%",
      lastViewedAt: "2026-10-10T00:00:00.000Z",
    });
    expect((await page("旧メモの限定キーワード")).total).toBe(0);
    expect((await page()).entries[0]).not.toHaveProperty("note");
    await mutate({ intent: "clearHistory" });
    expect(sqlite.prepare("SELECT * FROM user_library_entries").get()).toEqual(before);
  });

  it.each(["setSaved", "saveNote", "recordReaction", "like", "comment_like", "unknown"])(
    "保存・メモや評価の直接記録APIを受け付けない: %s",
    async (intent) => {
      await expect(
        mutate({ intent, postId: "1", note: "メモ", isSaved: "true" }),
      ).rejects.toMatchObject({ status: 400 });
      expect(prepares).toBe(0);
      expect(writes).toBe(0);
    },
  );

  it("GETは履歴や初期設定を書き込まない", async () => {
    expect(await getLibraryEntry(request(), 1)).toEqual({ entry: null, historyEnabled: true });
    await page();
    expect(writes).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_settings").get()).toEqual({
      n: 0,
    });
  });

  it("閲覧・記事いいね/良くないね・コメント評価/逆評価を一つの時系列にする", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    vi.setSystemTime(new Date("2026-10-10T00:01:00.000Z"));
    await react(1, "like");
    vi.setSystemTime(new Date("2026-10-10T00:02:00.000Z"));
    await react(2, "dislike");
    vi.setSystemTime(new Date("2026-10-10T00:03:00.000Z"));
    await react(1, "like", 1);
    vi.setSystemTime(new Date("2026-10-10T00:04:00.000Z"));
    await react(2, "dislike", 3);
    const before = writes;
    const result = await page();
    expect(result.total).toBe(5);
    expect(
      result.entries.map(({ postId, kind, occurredAt, commentId }) => ({
        postId,
        kind,
        occurredAt,
        commentId,
      })),
    ).toEqual([
      { postId: 2, kind: "comment_dislike", occurredAt: "2026-10-10T00:04:00.000Z", commentId: 3 },
      { postId: 1, kind: "comment_like", occurredAt: "2026-10-10T00:03:00.000Z", commentId: 1 },
      { postId: 2, kind: "dislike", occurredAt: "2026-10-10T00:02:00.000Z", commentId: null },
      { postId: 1, kind: "like", occurredAt: "2026-10-10T00:01:00.000Z", commentId: null },
      { postId: 1, kind: "view", occurredAt: "2026-10-10T00:00:00.000Z", commentId: null },
    ]);
    expect(result.entries[0].commentContent).toBe("コメントの限定キーワード");
    expect(result.entries[4].commentContent).toBeNull();
    expect(writes).toBe(before);
  });

  it("本文・タグ・評価したコメント本文も同じ検索で絞り込み、複数タグで重複しない", async () => {
    sqlite.exec(
      "INSERT INTO dim_tags VALUES (1, '職場'), (2, '職場の相談'); INSERT INTO rel_post_tags VALUES (1, 1), (1, 2);",
    );
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(2, "dislike", 3);
    expect((await page("本文だけ")).entries.map(({ postId }) => postId)).toEqual([2]);
    expect((await page("職場")).total).toBe(2);
    expect((await page("コメントの限定キーワード")).entries.map(({ kind }) => kind)).toEqual([
      "comment_dislike",
    ]);
    auth.user = ADMIN_B;
    await react(1, "like", 1);
    auth.user = ADMIN_A;
    expect((await page("聞き返す")).total).toBe(0);
  });

  it.each(["https://attacker.test", "null", ""])(
    "同一origin以外から閲覧・評価履歴を書き込めない: %s",
    async (origin) => {
      await expect(mutate({ intent: "recordView", postId: "1" }, origin)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        recordLibraryReaction(postRequest(origin), { postId: 1, voteType: "like" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(prepares).toBe(0);
    },
  );

  it("評価履歴はPOST以外では記録せず、不正評価・ID・親記事違いを拒否する", async () => {
    await expect(
      recordLibraryReaction(request(), { postId: 1, voteType: "like" }),
    ).rejects.toMatchObject({ status: 405 });
    await expect(react(1, "invalid" as "like")).rejects.toMatchObject({ status: 400 });
    await expect(react(1, "like", 0)).rejects.toMatchObject({ status: 400 });
    await expect(react(1, "like", 3)).rejects.toMatchObject({ status: 404 });
    await expect(react(1, "like", 9999)).rejects.toMatchObject({ status: 404 });
    await expect(react(9999, "like")).rejects.toMatchObject({ status: 404 });
    expect(writes).toBe(0);
  });

  it("30分以内の再閲覧ではDBに再書き込みせず、30分後に更新する", async () => {
    const first = await mutate({ intent: "recordView", postId: "1" });
    const before = writes;
    vi.setSystemTime(new Date("2026-10-10T00:29:59.000Z"));
    expect(await mutate({ intent: "recordView", postId: "1" })).toEqual(first);
    expect(writes).toBe(before);
    vi.setSystemTime(new Date("2026-10-10T00:30:00.000Z"));
    expect(await mutate({ intent: "recordView", postId: "1" })).toMatchObject({
      entry: { lastViewedAt: "2026-10-10T00:30:00.000Z" },
    });
    expect(writes).toBeGreaterThan(before);
  });

  it.each([undefined, 1])(
    "評価の再送は30分間重複書き込みせず、以降は同じ一件を最新に更新する: %s",
    async (commentId) => {
      await react(1, "like", commentId);
      const before = writes;
      vi.setSystemTime(new Date("2026-10-10T00:29:59.000Z"));
      await react(1, "like", commentId);
      expect(writes).toBe(before);
      vi.setSystemTime(new Date("2026-10-10T00:30:00.000Z"));
      await react(1, "like", commentId);
      expect((await page()).total).toBe(1);
      expect((await page()).entries[0].occurredAt).toBe("2026-10-10T00:30:00.000Z");
      vi.setSystemTime(new Date("2027-02-10T00:00:00.000Z"));
      expect((await page()).total).toBe(0);
      await react(1, "like", commentId);
      expect((await page()).entries[0].occurredAt).toBe("2027-02-10T00:00:00.000Z");
    },
  );

  it("記録停止はその管理者の閲覧・記事評価・コメント評価すべてに適用する", async () => {
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    const before = writes;
    expect(await mutate({ intent: "recordView", postId: "1" })).toEqual({
      success: true,
      entry: null,
      historyEnabled: false,
    });
    await react(1, "like");
    await react(1, "dislike", 1);
    expect(writes).toBe(before);
    expect((await page()).total).toBe(0);
    auth.user = ADMIN_B;
    await react(1, "like");
    expect((await page()).total).toBe(1);
    auth.user = ADMIN_A;
    await mutate({ intent: "setHistoryEnabled", enabled: "true" });
    await react(1, "dislike", 1);
    expect((await page()).total).toBe(1);
  });

  it("消去は閲覧・評価すべてを消し、既存保存・メモと別管理者の履歴を保全する", async () => {
    legacyEntry();
    const legacy = sqlite.prepare("SELECT * FROM user_library_entries").get();
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(1, "dislike");
    await react(1, "like", 1);
    await react(1, "dislike", 1);
    auth.user = ADMIN_B;
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like", 1);
    auth.user = ADMIN_A;
    await mutate({ intent: "clearHistory" });
    expect((await page()).total).toBe(0);
    expect(
      sqlite
        .prepare("SELECT * FROM user_library_entries WHERE user_uuid = ?")
        .get(ADMIN_A.userUuid),
    ).toEqual(legacy);
    auth.user = ADMIN_B;
    expect((await page()).total).toBe(2);
  });

  it("90日を超えた全種類の履歴を隠し、次の記録時に旧保存・メモを保持して整理する", async () => {
    legacyEntry(1, "2026-01-01T00:00:00.000Z");
    sqlite.exec(
      "INSERT INTO user_library_entries (user_uuid, post_id, last_viewed_at) VALUES ('admin-a', 2, '2026-01-01T00:00:00.000Z'); INSERT INTO user_library_reactions VALUES ('admin-a', 1, NULL, 'like', 1, '2026-01-01T00:00:00.000Z');",
    );
    expect((await page()).total).toBe(0);
    expect((await getLibraryEntry(request(), 1)).entry).toBeNull();
    await react(3, "dislike");
    expect((await page()).total).toBe(1);
    expect(
      sqlite
        .prepare(
          "SELECT last_viewed_at, note, is_saved FROM user_library_entries WHERE post_id = 1",
        )
        .get(),
    ).toEqual({ last_viewed_at: null, note: "旧メモの限定キーワード", is_saved: 1 });
    expect(
      sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_entries WHERE post_id = 2").get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_reactions WHERE kind = 'like'").get(),
    ).toEqual({ n: 0 });
  });

  it("閲覧と評価あわせて最新500件に制限し、同時刻でも表示順と保持順を一致させる", async () => {
    const timestamp = "2026-10-09T00:00:00.000Z";
    const insertView = sqlite.prepare(
      "INSERT INTO user_library_entries (user_uuid, post_id, last_viewed_at) VALUES ('admin-a', ?, ?)",
    );
    const insertLike = sqlite.prepare(
      "INSERT INTO user_library_reactions VALUES ('admin-a', ?, NULL, 'like', ?, ?)",
    );
    sqlite.transaction(() => {
      for (let i = 1; i <= 550; i++) {
        insertView.run(i, timestamp);
        insertLike.run(i, i, timestamp);
      }
    })();
    sqlite
      .prepare("UPDATE user_library_entries SET note = '残す', is_saved = 1 WHERE post_id = 1")
      .run();
    await react(550, "dislike");
    const result = await page();
    expect(result).toMatchObject({ total: 500, totalPages: 10 });
    expect(result.entries).toHaveLength(50);
    expect(result.entries[0]).toMatchObject({ postId: 550, kind: "dislike" });
    const last = await page("", 10);
    expect(last.entries.at(-1)).toMatchObject({ postId: 301, kind: "view" });
    expect(
      sqlite
        .prepare(
          "SELECT note, is_saved, last_viewed_at FROM user_library_entries WHERE post_id = 1",
        )
        .get(),
    ).toEqual({ note: "残す", is_saved: 1, last_viewed_at: null });
    expect((await page("", 999)).page).toBe(10);
  });

  it("検索のSQLワイルドカードは文字として扱い、タイトルとコメントを検索する", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like", 1);
    await mutate({ intent: "recordView", postId: "3" });
    expect((await page("%")).total).toBe(2);
    expect((await page("_")).entries.map(({ kind }) => kind)).toEqual(["comment_like"]);
    expect((await page("会議", 999)).page).toBe(1);
    expect((await page("no-match")).total).toBe(0);
  });

  it.each(["0", "-1", "1.5", "NaN", "9007199254740992", "", "1e0"])(
    "不正な記事IDを拒否する: %s",
    async (postId) => {
      await expect(getLibraryEntry(request(), postId)).rejects.toMatchObject({ status: 400 });
      await expect(mutate({ intent: "recordView", postId })).rejects.toMatchObject({ status: 400 });
      expect(writes).toBe(0);
    },
  );

  it("存在しない記事と不正な設定値を拒否する", async () => {
    await expect(mutate({ intent: "recordView", postId: "99999" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(mutate({ intent: "setHistoryEnabled", enabled: "1" })).rejects.toBeInstanceOf(
      LibraryError,
    );
    expect(writes).toBe(0);
  });

  it("コメント・記事・ユーザー削除時にFKで該当履歴を削除する", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(1, "like", 1);
    sqlite.prepare("DELETE FROM dim_comments WHERE comment_id = 1").run();
    expect((await page()).total).toBe(2);
    sqlite.prepare("DELETE FROM dim_posts WHERE post_id = 1").run();
    expect((await page()).total).toBe(0);
    await react(2, "like", 3);
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    sqlite.prepare("DELETE FROM dim_users WHERE user_uuid = 'admin-a'").run();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_reactions").get()).toEqual({
      n: 0,
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_settings").get()).toEqual({
      n: 0,
    });
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO user_library_reactions VALUES ('missing-user', 2, NULL, 'like', 2, ?)",
        )
        .run("2026-10-10T00:00:00.000Z"),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO user_library_reactions VALUES ('admin-b', 2, NULL, 'comment_like', 2, ?)",
        )
        .run("2026-10-10T00:00:00.000Z"),
    ).toThrow();
  });
});
