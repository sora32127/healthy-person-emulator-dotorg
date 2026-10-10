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
let maxBindings: number;

function createD1Adapter(): D1Database {
  function prepare(sql: string) {
    prepares++;
    let values: unknown[] = [];
    const statement = {
      bind(...parameters: unknown[]) {
        values = parameters;
        maxBindings = Math.max(maxBindings, parameters.length);
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
function mutate(values: Record<string, string | string[]>, origin = "https://example.test") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
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
  maxBindings = 0;
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
    expect((await page()).entries).toMatchObject([
      { postId: 1, events: [{ kind: "view" }, { kind: "comment_like", commentId: 1 }] },
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

  it("記事ごとに5種類のイベントをまとめ、最新日時順に返して一覧取得では書き込まない", async () => {
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
    expect(result.total).toBe(2);
    expect(result.entries).toEqual([
      {
        postId: 2,
        postTitle: "事例 2",
        occurredAt: "2026-10-10T00:04:00.000Z",
        events: [
          { kind: "comment_dislike", occurredAt: "2026-10-10T00:04:00.000Z", commentId: 3 },
          { kind: "dislike", occurredAt: "2026-10-10T00:02:00.000Z", commentId: null },
        ],
      },
      {
        postId: 1,
        postTitle: "会議での事例 100%",
        occurredAt: "2026-10-10T00:03:00.000Z",
        events: [
          { kind: "comment_like", occurredAt: "2026-10-10T00:03:00.000Z", commentId: 1 },
          { kind: "like", occurredAt: "2026-10-10T00:01:00.000Z", commentId: null },
          { kind: "view", occurredAt: "2026-10-10T00:00:00.000Z", commentId: null },
        ],
      },
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
    expect((await page("職場")).total).toBe(1);
    expect((await page("%")).total).toBe(1);
    expect((await page("職場")).entries[0].events.map(({ kind }) => kind)).toEqual(["view", "like"]);
    expect((await page("コメントの限定キーワード")).entries[0].events.map(({ kind }) => kind)).toEqual([
      "comment_dislike",
    ]);
    auth.user = ADMIN_B;
    await react(1, "like", 1);
    auth.user = ADMIN_A;
    expect((await page("聞き返す")).total).toBe(0);
    expect((await page("no-match")).total).toBe(0);
  });

  it("同じ記事の複数コメント評価を保ち、検索に一致したイベントだけをまとめる", async () => {
    await mutate({ intent: "recordView", postId: "1" });
    vi.setSystemTime(new Date("2026-10-10T00:01:00.000Z"));
    await react(1, "like", 1);
    vi.setSystemTime(new Date("2026-10-10T00:02:00.000Z"));
    await react(1, "like", 2);
    vi.setSystemTime(new Date("2026-10-10T00:03:00.000Z"));
    await mutate({ intent: "recordView", postId: "2" });
    const before = writes;
    const result = await page();
    expect(result.entries.map(({ postId }) => postId)).toEqual([2, 1]);
    expect(result.entries[1].events).toEqual([
      { kind: "comment_like", commentId: 2, occurredAt: "2026-10-10T00:02:00.000Z" },
      { kind: "comment_like", commentId: 1, occurredAt: "2026-10-10T00:01:00.000Z" },
      { kind: "view", commentId: null, occurredAt: "2026-10-10T00:00:00.000Z" },
    ]);
    expect(await page("聞き返す_")).toMatchObject({
      total: 1,
      entries: [{
        postId: 1,
        occurredAt: "2026-10-10T00:01:00.000Z",
        events: [{ kind: "comment_like", commentId: 1 }],
      }],
    });
    expect((await page("聞き返す_")).entries[0].events).toHaveLength(1);
    expect(writes).toBe(before);
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
    expect(result.total).toBe(1);
    expect(result.entries[0].events).toHaveLength(3);
    expect(result.entries[0].events.every(({ occurredAt }) => occurredAt === "2026-10-10T00:30:00.000Z")).toBe(true);
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
    expect((await page()).total).toBe(1);
  });

  it("記録停止中も選んだ履歴だけを消去し、他人・別イベント・更新後の履歴を保つ", async () => {
    const occurredAt = "2026-10-10T00:00:00.000Z";
    await mutate({ intent: "recordView", postId: "1" });
    await mutate({ intent: "recordView", postId: "2" });
    await react(1, "like");
    await react(1, "dislike");
    await react(2, "like");
    await react(1, "like", 1);
    await react(1, "dislike", 1);
    await react(1, "like", 2);
    auth.user = ADMIN_B;
    await mutate({ intent: "recordView", postId: "1" });
    await react(1, "like");
    await react(1, "like", 1);
    auth.user = ADMIN_A;
    vi.setSystemTime(new Date("2026-10-10T00:30:00.000Z"));
    await mutate({ intent: "recordView", postId: "2" });
    await mutate({ intent: "setHistoryEnabled", enabled: "false" });
    const before = (await page()).entries;
    const tables = ["dim_posts", "dim_comments", "user_library_settings"];
    const preserved = tables.map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all());
    const entries = ["view", "like", "comment_like"].map((kind) =>
      JSON.stringify({ kind, targetId: 1, occurredAt }),
    );
    const invalidEntries = [
      [], Array(501).fill(entries[0]), [entries[0], "invalid"],
      ...[{ kind: "save" }, { targetId: 1.5 }, { occurredAt: "invalid" }].map((invalid) => [
        entries[0], JSON.stringify({ kind: "view", targetId: 2, occurredAt, ...invalid }),
      ]),
    ];
    for (const entries of invalidEntries) {
      await expect(mutate({ intent: "clearEntries", entries }))
        .rejects.toMatchObject({ status: 400 });
    }
    expect((await page()).entries).toEqual(before);
    await mutate({ intent: "clearEntries", entries, userUuid: ADMIN_B.userUuid });
    await expect(mutate({ intent: "clearEntries", entries })).resolves.toEqual({ success: true });
    await mutate({ intent: "clearEntries", entries: [
      JSON.stringify({ kind: "view", targetId: 2, occurredAt }),
      JSON.stringify({ kind: "like", targetId: 999, occurredAt }),
    ] });
    expect(await page()).toMatchObject({
      entries: before.map((entry) => ({
        ...entry,
        events: entry.events.filter((event) => !(entry.postId === 1 && (
          event.kind === "view" || event.kind === "like" ||
          (event.kind === "comment_like" && event.commentId === 1)
        ))),
      })),
      total: 2,
      historyEnabled: false,
    });
    expect(tables.map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all())).toEqual(preserved);
    auth.user = ADMIN_B;
    expect((await page()).total).toBe(1);
  });

  it("50記事にまとめた最大500イベントを一度に選択消去できる", async () => {
    const timestamp = "2026-10-09T00:00:00.000Z";
    const insertPost = sqlite.prepare("INSERT INTO dim_posts VALUES (?, ?, '本文')");
    const insertView = sqlite.prepare("INSERT INTO user_library_entries VALUES ('admin-a', ?, ?)");
    const insertComment = sqlite.prepare("INSERT INTO dim_comments VALUES (?, ?, 'コメント')");
    const insertReaction = sqlite.prepare(
      "INSERT INTO user_library_reactions VALUES ('admin-a', ?, ?, 'comment_like', ?, ?)",
    );
    sqlite.transaction(() => {
      for (let postId = 1; postId <= 50; postId++) {
        if (postId > 3) insertPost.run(postId, `事例 ${postId}`);
        insertView.run(postId, timestamp);
        for (let index = 1; index <= 9; index++) {
          const commentId = 1000 + postId * 10 + index;
          insertComment.run(commentId, postId);
          insertReaction.run(postId, commentId, commentId, timestamp);
        }
      }
    })();
    sqlite.prepare("INSERT INTO user_library_entries VALUES ('admin-b', 1, ?)").run(timestamp);
    const result = await page();
    expect(result).toMatchObject({ total: 50, totalPages: 1 });
    expect(result.entries).toHaveLength(50);
    expect(result.entries.every(({ events }) => events.length === 10)).toBe(true);
    const entries = result.entries.flatMap((entry) =>
      entry.events.map((event) => JSON.stringify({
        kind: event.kind,
        targetId: event.commentId ?? entry.postId,
        occurredAt: event.occurredAt,
      })),
    );
    expect(entries).toHaveLength(500);
    prepares = 0;
    maxBindings = 0;
    const before = writes;
    await mutate({ intent: "clearEntries", entries });
    expect(writes - before).toBe(17);
    expect(prepares).toBeLessThanOrEqual(18);
    expect(maxBindings).toBe(97);
    expect((await page()).total).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM dim_posts").get()).toEqual({ n: 50 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM dim_comments").get()).toEqual({ n: 453 });
    auth.user = ADMIN_B;
    expect((await page()).total).toBe(1);
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

  it("最新500イベントの記録を保ち、同じ記事を分割せず50記事ずつページ表示する", async () => {
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
    expect(result).toMatchObject({ total: 250, totalPages: 5 });
    expect(result.entries).toHaveLength(50);
    expect(result.entries.map(({ postId }) => postId)).toEqual(
      Array.from({ length: 50 }, (_, index) => 550 - index),
    );
    expect(result.entries[0]).toMatchObject({
      postId: 550,
      events: [{ kind: "dislike" }, { kind: "view" }, { kind: "like" }],
    });
    const next = await page("", 2);
    expect(next.entries[0].postId).toBe(500);
    expect(next.entries.every(({ events }) => events.length === 2)).toBe(true);
    const last = await page("", 5);
    expect(last.entries.at(-1)).toMatchObject({ postId: 301, events: [{ kind: "view" }] });
    expect((await page("", 999)).page).toBe(5);
    expect((await page("", 0)).page).toBe(1);
    expect((await page("", Number.NaN)).page).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_entries").get()).toEqual({ n: 250 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_library_reactions").get()).toEqual({ n: 250 });
  });
});
