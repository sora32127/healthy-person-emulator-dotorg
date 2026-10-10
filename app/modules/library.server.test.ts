// @vitest-environment node
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLibraryPage,
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
      async raw() {
        return sqlite.prepare(sql).raw().all(...values);
      },
      run() {
        writes++;
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: result.changes } };
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: { run(): unknown }[]) {
      return sqlite.transaction(() => statements.map((statement) => statement.run()))();
    },
  } as unknown as D1Database;
}

function migration(name: string) {
  return readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
}
function request() {
  return new Request("https://example.test/api/library");
}
function postRequest(origin = "https://example.test", body?: FormData) {
  return new Request("https://example.test/archives/1", {
    method: "POST",
    headers: { Origin: origin },
    body,
  });
}
function mutate(values: Record<string, string>, origin = "https://example.test") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return mutateLibrary(postRequest(origin, formData));
}
function react(postId: number, voteType: "like" | "dislike", commentId?: number) {
  return recordLibraryReaction(postRequest(), { postId, voteType, commentId });
}
function page(query = "", pageNumber = 1) {
  return getLibraryPage(request(), { query, page: pageNumber });
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
  sqlite.exec(migration("0008_add_user_history.sql"));
  const insertPost = sqlite.prepare("INSERT INTO dim_posts VALUES (?, ?, ?)");
  sqlite.transaction(() => {
    for (let i = 1; i <= 3; i++) {
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
  it("送信された所有者を無視し、本人の履歴だけを読み書きする", async () => {
    await mutate({ intent: "recordView", postId: "1", userUuid: ADMIN_B.userUuid });
    await react(1, "like", 1);
    auth.user = ADMIN_B;
    expect((await page()).total).toBe(0);
    await react(2, "dislike");
    auth.user = ADMIN_A;
    expect((await page()).entries.map(({ postId, kind }) => [postId, kind])).toEqual([
      [1, "view"],
      [1, "comment_like"],
    ]);
  });

  it("対象外になったユーザーはページ・記録APIを利用できず、既存評価も履歴を書かない", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    const before = writes;
    (globalThis as any).__cloudflareEnv.ADMIN_EMAILS = "";
    prepares = 0;
    await expect(mutate({ intent: "recordView", postId: "1" })).rejects.toMatchObject({ status: 403 });
    const result = await page().catch((error) => error);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("/");
    await react(2, "like");
    auth.user = null;
    await react(1, "dislike", 1);
    expect(prepares).toBe(0);
    expect(writes).toBe(before);
  });

  it("5種類のイベントを日時順に返し、一覧の取得では書き込まない", async () => {
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
    expect(result.entries.map(({ postId, kind, occurredAt, commentId }) => ({
      postId, kind, occurredAt, commentId,
    }))).toEqual([
      { postId: 2, kind: "comment_dislike", occurredAt: "2026-10-10T00:04:00.000Z", commentId: 3 },
      { postId: 1, kind: "comment_like", occurredAt: "2026-10-10T00:03:00.000Z", commentId: 1 },
      { postId: 2, kind: "dislike", occurredAt: "2026-10-10T00:02:00.000Z", commentId: null },
      { postId: 1, kind: "like", occurredAt: "2026-10-10T00:01:00.000Z", commentId: null },
      { postId: 1, kind: "view", occurredAt: "2026-10-10T00:00:00.000Z", commentId: null },
    ]);
    expect(writes).toBe(before);
  });

  it("タイトル・本文・タグ・コメント本文を検索し、複数タグでも重複しない", async () => {
    sqlite.exec(
      "INSERT INTO dim_tags VALUES (1, '職場'), (2, '職場の相談'); INSERT INTO rel_post_tags VALUES (1, 1), (1, 2);",
    );
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(2, "dislike", 3);
    expect((await page("本文だけ")).entries.map(({ postId }) => postId)).toEqual([2]);
    expect((await page("職場")).total).toBe(2);
    expect((await page("%")).total).toBe(2);
    expect((await page("コメントの限定キーワード")).entries.map(({ kind }) => kind)).toEqual([
      "comment_dislike",
    ]);
    auth.user = ADMIN_B;
    await react(1, "like", 1);
    auth.user = ADMIN_A;
    expect((await page("聞き返す")).total).toBe(0);
    expect((await page("no-match")).total).toBe(0);
  });

  it("評価履歴は別origin・別記事のコメントへの記録を受け付けない", async () => {
    await expect(recordLibraryReaction(postRequest("https://attacker.test"), { postId: 1, voteType: "like" }))
      .rejects.toMatchObject({ status: 403 });
    await expect(react(1, "like", 3)).rejects.toMatchObject({ status: 404 });
    expect(writes).toBe(0);
  });

  it("閲覧・評価の再送を30分間は書き込まず、その後は同じイベントを更新する", async () => {
    async function record() {
      await mutate({ intent: "recordView", postId: "1" });
      await react(1, "like");
      await react(1, "dislike", 1);
    }
    await record();
    const before = writes;
    vi.setSystemTime(new Date("2026-10-10T00:29:59.000Z"));
    await record();
    expect(writes).toBe(before);
    vi.setSystemTime(new Date("2026-10-10T00:30:00.000Z"));
    await record();
    const result = await page();
    expect(result.total).toBe(3);
    expect(result.entries.every(({ occurredAt }) => occurredAt === "2026-10-10T00:30:00.000Z")).toBe(true);
    expect(writes).toBeGreaterThan(before);
  });

  it("記録の停止・再開を閲覧と評価すべてに適用し、別ユーザーには影響させない", async () => {
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    const before = writes;
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(1, "dislike", 1);
    expect(writes).toBe(before);
    expect(await page()).toMatchObject({ total: 0, historyEnabled: false });
    auth.user = ADMIN_B;
    await react(1, "like");
    expect((await page()).total).toBe(1);
    auth.user = ADMIN_A;
    await mutate({ intent: "setHistoryEnabled", enabled: "true" });
    await react(1, "dislike", 1);
    expect(await page()).toMatchObject({ total: 1, historyEnabled: true });
  });

  it("本人の全種類の履歴を消去し、別ユーザーの履歴を保つ", async () => {
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
    auth.user = ADMIN_B;
    expect((await page()).total).toBe(2);
  });

  it("90日を超えた履歴を表示せず、次の記録時に整理する", async () => {
    sqlite.exec(
      "INSERT INTO user_library_entries VALUES ('admin-a', 1, '2026-01-01T00:00:00.000Z'); INSERT INTO user_library_reactions VALUES ('admin-a', 1, NULL, 'like', 1, '2026-01-01T00:00:00.000Z');",
    );
    expect((await page()).total).toBe(0);
    expect(writes).toBe(0);
    await react(3, "dislike");
    expect((await page()).total).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_entries").get()).toEqual({ n: 0 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_reactions").get()).toEqual({ n: 1 });
  });

  it("閲覧と評価を合わせて最新500件を保ち、50件ずつ同じ順でページ表示する", async () => {
    const timestamp = "2026-10-09T00:00:00.000Z";
    const insertPost = sqlite.prepare("INSERT INTO dim_posts VALUES (?, ?, '本文')");
    const insertView = sqlite.prepare("INSERT INTO user_library_entries VALUES ('admin-a', ?, ?)");
    const insertLike = sqlite.prepare("INSERT INTO user_library_reactions VALUES ('admin-a', ?, NULL, 'like', ?, ?)");
    sqlite.transaction(() => {
      for (let i = 1; i <= 550; i++) {
        if (i > 3) insertPost.run(i, `事例 ${i}`);
        insertView.run(i, timestamp);
        insertLike.run(i, i, timestamp);
      }
    })();
    await react(550, "dislike");
    const result = await page();
    expect(result).toMatchObject({ total: 500, totalPages: 10 });
    expect(result.entries).toHaveLength(50);
    expect(result.entries[0]).toMatchObject({ postId: 550, kind: "dislike" });
    const last = await page("", 10);
    expect(last.entries.at(-1)).toMatchObject({ postId: 301, kind: "view" });
    expect((await page("", 999)).page).toBe(10);
  });
});
