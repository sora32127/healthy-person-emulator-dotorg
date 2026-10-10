import { redirect } from "react-router";
import { isLibraryEnabledForUser } from "./feature-flags.server";
import { getAuthenticatedUser } from "./auth.google.server";

export type LibraryEntry = {
  postId: number;
  postTitle: string;
  lastViewedAt: string;
};

export type LibraryTimelineEvent = {
  postId: number;
  postTitle: string;
  kind: "view" | "like" | "dislike" | "comment_like" | "comment_dislike";
  occurredAt: string;
  commentId: number | null;
  commentContent: string | null;
};

const PAGE_SIZE = 50;
const HISTORY_LIMIT = 500;
const HISTORY_DAYS = 90;
const VIEW_INTERVAL_MS = 30 * 60 * 1000;

export class LibraryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getDb(): D1Database {
  const db = (globalThis as any).__cloudflareEnv?.DB as D1Database | undefined;
  if (!db) throw new Error("DB is not configured");
  return db;
}

async function requireLibraryUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new LibraryError(401, "ログインが必要です");
  if (!isLibraryEnabledForUser(user)) throw new LibraryError(403, "この機能は現在利用できません");
  return user;
}

function parsePostId(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new LibraryError(400, "記事IDが不正です");
  }
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    throw new LibraryError(400, "記事IDが不正です");
  }
  const postId = Number(value);
  if (!Number.isSafeInteger(postId) || postId <= 0) {
    throw new LibraryError(400, "記事IDが不正です");
  }
  return postId;
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (value !== "true" && value !== "false") {
    throw new LibraryError(400, "設定値が不正です");
  }
  return value === "true";
}

function assertSameOriginPost(request: Request) {
  if (request.method !== "POST") throw new LibraryError(405, "POSTで送信してください");
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    throw new LibraryError(403, "送信元が不正です");
  }
}

function historyCutoff(now = new Date()): string {
  return new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function readHistoryEnabled(db: D1Database, userUuid: string): Promise<boolean> {
  const setting = await db
    .prepare("SELECT history_enabled AS enabled FROM user_library_settings WHERE user_uuid = ?")
    .bind(userUuid)
    .first<{ enabled: number }>();
  return setting?.enabled !== 0;
}

async function assertPostExists(db: D1Database, postId: number) {
  const post = await db
    .prepare("SELECT post_id FROM dim_posts WHERE post_id = ?")
    .bind(postId)
    .first();
  if (!post) throw new LibraryError(404, "記事が見つかりません");
}

async function readEntry(
  db: D1Database,
  userUuid: string,
  postId: number,
): Promise<LibraryEntry | null> {
  return db
    .prepare(
      `SELECT e.post_id AS postId, p.post_title AS postTitle, e.last_viewed_at AS lastViewedAt
       FROM user_library_entries e INNER JOIN dim_posts p ON p.post_id = e.post_id
       WHERE e.user_uuid = ? AND e.post_id = ? AND e.last_viewed_at >= ?`,
    )
    .bind(userUuid, postId, historyCutoff())
    .first<LibraryEntry>();
}

export async function getLibraryEntry(request: Request, rawPostId: number | string) {
  const user = await requireLibraryUser(request);
  const postId = parsePostId(rawPostId);
  const db = getDb();
  await assertPostExists(db, postId);
  const [entry, historyEnabled] = await Promise.all([
    readEntry(db, user.userUuid, postId),
    readHistoryEnabled(db, user.userUuid),
  ]);
  return { entry, historyEnabled };
}

export async function getLibraryPage(request: Request, options: { query: string; page: number }) {
  const user = await getAuthenticatedUser(request);
  if (!user || !isLibraryEnabledForUser(user)) throw redirect("/");
  const db = getDb();
  const cutoff = historyCutoff();
  const query = options.query.trim().slice(0, 200);
  const bindings: (string | number)[] = [user.userUuid, cutoff, user.userUuid, cutoff];
  let filter = "";
  if (query) {
    filter = `WHERE (e.postTitle LIKE ? ESCAPE '\\' OR e.postContent LIKE ? ESCAPE '\\'
                    OR e.commentContent LIKE ? ESCAPE '\\' OR EXISTS (
                      SELECT 1 FROM rel_post_tags pt INNER JOIN dim_tags t ON t.tag_id = pt.tag_id
                      WHERE pt.post_id = e.postId AND t.tag_name LIKE ? ESCAPE '\\'))`;
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(pattern, pattern, pattern, pattern);
  }
  const eventsCte = `WITH events AS (
    SELECT e.post_id AS postId, p.post_title AS postTitle, p.post_content AS postContent,
           'view' AS kind, e.last_viewed_at AS occurredAt, e.post_id AS targetId,
           NULL AS commentId, NULL AS commentContent
    FROM user_library_entries e INNER JOIN dim_posts p ON p.post_id = e.post_id
    WHERE e.user_uuid = ? AND e.last_viewed_at >= ?
    UNION ALL
    SELECT r.post_id AS postId, p.post_title AS postTitle, p.post_content AS postContent,
           r.kind, r.occurred_at AS occurredAt, r.target_id AS targetId,
           r.comment_id AS commentId, c.comment_content AS commentContent
    FROM user_library_reactions r INNER JOIN dim_posts p ON p.post_id = r.post_id
    LEFT JOIN dim_comments c ON c.comment_id = r.comment_id AND c.post_id = r.post_id
    WHERE r.user_uuid = ? AND r.occurred_at >= ?
  )`;
  const [count, historyEnabled] = await Promise.all([
    db
      .prepare(`${eventsCte} SELECT COUNT(*) AS total FROM events e ${filter}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    readHistoryEnabled(db, user.userUuid),
  ]);
  const total = count?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    totalPages,
    Number.isSafeInteger(options.page) && options.page > 0 ? options.page : 1,
  );
  const rows = await db
    .prepare(
      `${eventsCte}
       SELECT postId, postTitle, kind, occurredAt, commentId, commentContent FROM events e ${filter}
       ORDER BY occurredAt DESC, postId DESC, kind DESC, targetId DESC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .all<LibraryTimelineEvent>();
  return { entries: rows.results, page, totalPages, total, historyEnabled };
}

function removeEmptyEntries(db: D1Database, userUuid: string) {
  return db
    .prepare(
      `DELETE FROM user_library_entries
       WHERE user_uuid = ? AND is_saved = 0 AND note = '' AND last_viewed_at IS NULL`,
    )
    .bind(userUuid);
}

function pruneHistory(db: D1Database, userUuid: string, now: Date) {
  const keepCte = `WITH events AS (
    SELECT 'view' AS kind, post_id AS postId, post_id AS targetId, last_viewed_at AS occurredAt
    FROM user_library_entries WHERE user_uuid = ? AND last_viewed_at IS NOT NULL
    UNION ALL
    SELECT kind, post_id AS postId, target_id AS targetId, occurred_at AS occurredAt
    FROM user_library_reactions WHERE user_uuid = ?
  ), keep AS (
    SELECT kind, targetId FROM events
    ORDER BY occurredAt DESC, postId DESC, kind DESC, targetId DESC LIMIT ?
  )`;
  return [
    db
      .prepare(
        `${keepCte} UPDATE user_library_entries SET last_viewed_at = NULL
         WHERE user_uuid = ? AND last_viewed_at IS NOT NULL AND (last_viewed_at < ? OR NOT EXISTS (
           SELECT 1 FROM keep WHERE keep.kind = 'view' AND keep.targetId = user_library_entries.post_id))`,
      )
      .bind(userUuid, userUuid, HISTORY_LIMIT, userUuid, historyCutoff(now)),
    db
      .prepare(
        `${keepCte} DELETE FROM user_library_reactions
         WHERE user_uuid = ? AND (occurred_at < ? OR NOT EXISTS (
           SELECT 1 FROM keep WHERE keep.kind = user_library_reactions.kind
           AND keep.targetId = user_library_reactions.target_id))`,
      )
      .bind(userUuid, userUuid, HISTORY_LIMIT, userUuid, historyCutoff(now)),
    removeEmptyEntries(db, userUuid),
  ];
}

export async function recordLibraryReaction(
  request: Request,
  reaction: { postId: number; voteType: "like" | "dislike"; commentId?: number },
): Promise<void> {
  const user = await getAuthenticatedUser(request);
  if (!user || !isLibraryEnabledForUser(user)) return;
  assertSameOriginPost(request);
  if (reaction.voteType !== "like" && reaction.voteType !== "dislike") {
    throw new LibraryError(400, "評価が不正です");
  }
  const postId = parsePostId(reaction.postId);
  const commentId = reaction.commentId === undefined ? null : parsePostId(reaction.commentId);
  const db = getDb();
  if (!(await readHistoryEnabled(db, user.userUuid))) return;
  await assertPostExists(db, postId);
  if (commentId !== null) {
    const comment = await db
      .prepare("SELECT comment_id FROM dim_comments WHERE comment_id = ? AND post_id = ?")
      .bind(commentId, postId)
      .first();
    if (!comment) throw new LibraryError(404, "コメントが見つかりません");
  }
  const kind = commentId === null ? reaction.voteType : `comment_${reaction.voteType}`;
  const targetId = commentId ?? postId;
  const current = await db
    .prepare(
      "SELECT occurred_at AS occurredAt FROM user_library_reactions WHERE user_uuid = ? AND kind = ? AND target_id = ?",
    )
    .bind(user.userUuid, kind, targetId)
    .first<{ occurredAt: string }>();
  const now = new Date();
  if (current && now.getTime() - Date.parse(current.occurredAt) < VIEW_INTERVAL_MS) return;
  await db.batch([
    db
      .prepare(
        `INSERT INTO user_library_reactions (user_uuid, post_id, comment_id, kind, target_id, occurred_at)
         SELECT ?, ?, ?, ?, ?, ? WHERE COALESCE(
           (SELECT history_enabled FROM user_library_settings WHERE user_uuid = ?), 1) = 1
         ON CONFLICT(user_uuid, kind, target_id) DO UPDATE SET occurred_at = excluded.occurred_at
         WHERE user_library_reactions.occurred_at <= ?`,
      )
      .bind(
        user.userUuid,
        postId,
        commentId,
        kind,
        targetId,
        now.toISOString(),
        user.userUuid,
        new Date(now.getTime() - VIEW_INTERVAL_MS).toISOString(),
      ),
    ...pruneHistory(db, user.userUuid, now),
  ]);
}

export async function mutateLibrary(request: Request, suppliedFormData?: FormData) {
  const user = await requireLibraryUser(request);
  assertSameOriginPost(request);
  let formData: FormData;
  try {
    formData = suppliedFormData ?? (await request.formData());
  } catch {
    throw new LibraryError(400, "フォームが不正です");
  }
  const intent = formData.get("intent");
  if (!["recordView", "setHistoryEnabled", "clearHistory"].includes(String(intent))) {
    throw new LibraryError(400, "操作が不正です");
  }
  const db = getDb();
  const userUuid = user.userUuid;

  if (intent === "setHistoryEnabled") {
    const enabled = parseBoolean(formData.get("enabled"));
    await db
      .prepare(
        `INSERT INTO user_library_settings (user_uuid, history_enabled) VALUES (?, ?)
         ON CONFLICT(user_uuid) DO UPDATE SET history_enabled = excluded.history_enabled`,
      )
      .bind(userUuid, enabled ? 1 : 0)
      .run();
    return { success: true as const, historyEnabled: enabled };
  }
  if (intent === "clearHistory") {
    await db.batch([
      db
        .prepare("UPDATE user_library_entries SET last_viewed_at = NULL WHERE user_uuid = ?")
        .bind(userUuid),
      db.prepare("DELETE FROM user_library_reactions WHERE user_uuid = ?").bind(userUuid),
      removeEmptyEntries(db, userUuid),
    ]);
    return { success: true as const, historyEnabled: await readHistoryEnabled(db, userUuid) };
  }

  const postId = parsePostId(formData.get("postId"));
  await assertPostExists(db, postId);
  const now = new Date();
  const [historyEnabled, entry] = await Promise.all([
    readHistoryEnabled(db, userUuid),
    readEntry(db, userUuid, postId),
  ]);
  if (
    !historyEnabled ||
    (entry && now.getTime() - Date.parse(entry.lastViewedAt) < VIEW_INTERVAL_MS)
  ) {
    return { success: true as const, entry, historyEnabled };
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO user_library_entries (user_uuid, post_id, last_viewed_at)
         SELECT ?, ?, ? WHERE COALESCE(
           (SELECT history_enabled FROM user_library_settings WHERE user_uuid = ?), 1) = 1
         ON CONFLICT(user_uuid, post_id) DO UPDATE SET last_viewed_at = excluded.last_viewed_at
         WHERE user_library_entries.last_viewed_at IS NULL OR user_library_entries.last_viewed_at <= ?`,
      )
      .bind(
        userUuid,
        postId,
        now.toISOString(),
        userUuid,
        new Date(now.getTime() - VIEW_INTERVAL_MS).toISOString(),
      ),
    ...pruneHistory(db, userUuid, now),
  ]);
  return {
    success: true as const,
    entry: await readEntry(db, userUuid, postId),
    historyEnabled: await readHistoryEnabled(db, userUuid),
  };
}
