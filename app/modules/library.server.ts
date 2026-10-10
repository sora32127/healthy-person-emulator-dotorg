import { isAdminUser, requireAdmin } from "./admin.server";
import { getAuthenticatedUser } from "./auth.google.server";

export type LibraryEntry = {
  postId: number;
  postTitle: string;
  note: string;
  isSaved: boolean;
  savedAt: string | null;
  lastViewedAt: string | null;
};

type StoredEntry = Omit<LibraryEntry, "isSaved"> & { isSaved: number };
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
  if (!isAdminUser(user)) throw new LibraryError(403, "管理者のみ利用できます");
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

function toEntry(row: StoredEntry): LibraryEntry {
  return {
    ...row,
    isSaved: row.isSaved === 1,
    lastViewedAt: row.lastViewedAt && row.lastViewedAt >= historyCutoff() ? row.lastViewedAt : null,
  };
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
  const entry = await db
    .prepare(
      `SELECT e.post_id AS postId, p.post_title AS postTitle, e.note,
              e.is_saved AS isSaved, e.saved_at AS savedAt, e.last_viewed_at AS lastViewedAt
       FROM user_library_entries e INNER JOIN dim_posts p ON p.post_id = e.post_id
       WHERE e.user_uuid = ? AND e.post_id = ?`,
    )
    .bind(userUuid, postId)
    .first<StoredEntry>();
  return entry ? toEntry(entry) : null;
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

export async function getLibraryPage(
  request: Request,
  options: { view: "saved" | "history"; query: string; page: number },
) {
  const user = await requireAdmin(request);
  const db = getDb();
  const view = options.view === "history" ? "history" : "saved";
  const query = options.query.trim().slice(0, 200);
  const bindings: (string | number)[] = [user.userUuid];
  const conditions = ["e.user_uuid = ?"];
  if (view === "history") {
    conditions.push("e.last_viewed_at >= ?");
    bindings.push(historyCutoff());
  } else {
    conditions.push("(e.is_saved = 1 OR e.note <> '')");
  }
  if (query) {
    conditions.push("(p.post_title LIKE ? ESCAPE '\\' OR e.note LIKE ? ESCAPE '\\')");
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(pattern, pattern);
  }
  const fromWhere = `FROM user_library_entries e INNER JOIN dim_posts p ON p.post_id = e.post_id
                     WHERE ${conditions.join(" AND ")}`;
  const [count, historyEnabled] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS total ${fromWhere}`)
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
  const orderBy = view === "history" ? "e.last_viewed_at" : "e.saved_at";
  const rows = await db
    .prepare(
      `SELECT e.post_id AS postId, p.post_title AS postTitle, e.note,
              e.is_saved AS isSaved, e.saved_at AS savedAt, e.last_viewed_at AS lastViewedAt
       ${fromWhere} ORDER BY ${orderBy} DESC, e.post_id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .all<StoredEntry>();
  return { entries: rows.results.map(toEntry), page, totalPages, total, historyEnabled };
}

function removeEmptyEntries(db: D1Database, userUuid: string) {
  return db
    .prepare(
      `DELETE FROM user_library_entries
       WHERE user_uuid = ? AND is_saved = 0 AND note = '' AND last_viewed_at IS NULL`,
    )
    .bind(userUuid);
}

export async function mutateLibrary(request: Request, suppliedFormData?: FormData) {
  const user = await requireLibraryUser(request);
  if (request.method !== "POST") throw new LibraryError(405, "POSTで送信してください");
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    throw new LibraryError(403, "送信元が不正です");
  }
  let formData: FormData;
  try {
    formData = suppliedFormData ?? (await request.formData());
  } catch {
    throw new LibraryError(400, "フォームが不正です");
  }
  const intent = formData.get("intent");
  if (
    !["recordView", "setSaved", "saveNote", "setHistoryEnabled", "clearHistory"].includes(
      String(intent),
    )
  ) {
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
      removeEmptyEntries(db, userUuid),
    ]);
    return { success: true as const, historyEnabled: await readHistoryEnabled(db, userUuid) };
  }

  const postId = parsePostId(formData.get("postId"));
  await assertPostExists(db, postId);
  const now = new Date();
  const timestamp = now.toISOString();
  if (intent === "setSaved") {
    const isSaved = parseBoolean(formData.get("isSaved"));
    await db.batch([
      db
        .prepare(
          `INSERT INTO user_library_entries (user_uuid, post_id, is_saved, saved_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_uuid, post_id) DO UPDATE SET
             is_saved = excluded.is_saved,
             saved_at = CASE WHEN excluded.is_saved = 0 THEN NULL
                             ELSE COALESCE(user_library_entries.saved_at, excluded.saved_at) END`,
        )
        .bind(userUuid, postId, isSaved ? 1 : 0, isSaved ? timestamp : null),
      removeEmptyEntries(db, userUuid),
    ]);
  } else if (intent === "saveNote") {
    const note = formData.get("note");
    if (typeof note !== "string" || note.length > 2000) {
      throw new LibraryError(400, "メモは2000文字以内で入力してください");
    }
    await db.batch([
      db
        .prepare(
          `INSERT INTO user_library_entries (user_uuid, post_id, note) VALUES (?, ?, ?)
           ON CONFLICT(user_uuid, post_id) DO UPDATE SET note = excluded.note`,
        )
        .bind(userUuid, postId, note),
      removeEmptyEntries(db, userUuid),
    ]);
  } else {
    const [historyEnabled, entry] = await Promise.all([
      readHistoryEnabled(db, userUuid),
      readEntry(db, userUuid, postId),
    ]);
    if (
      !historyEnabled ||
      (entry?.lastViewedAt && now.getTime() - Date.parse(entry.lastViewedAt) < VIEW_INTERVAL_MS)
    ) {
      return { success: true as const, entry, historyEnabled };
    }
    const intervalCutoff = new Date(now.getTime() - VIEW_INTERVAL_MS).toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO user_library_entries (user_uuid, post_id, last_viewed_at)
           SELECT ?, ?, ? WHERE COALESCE(
             (SELECT history_enabled FROM user_library_settings WHERE user_uuid = ?), 1) = 1
           ON CONFLICT(user_uuid, post_id) DO UPDATE SET last_viewed_at = excluded.last_viewed_at
           WHERE user_library_entries.last_viewed_at IS NULL OR user_library_entries.last_viewed_at <= ?`,
        )
        .bind(userUuid, postId, timestamp, userUuid, intervalCutoff),
      db
        .prepare(
          `UPDATE user_library_entries SET last_viewed_at = NULL WHERE user_uuid = ?
           AND last_viewed_at IS NOT NULL AND (last_viewed_at < ? OR post_id NOT IN (
             SELECT post_id FROM user_library_entries WHERE user_uuid = ? AND last_viewed_at IS NOT NULL
             ORDER BY last_viewed_at DESC, post_id DESC LIMIT ?))`,
        )
        .bind(userUuid, historyCutoff(now), userUuid, HISTORY_LIMIT),
      removeEmptyEntries(db, userUuid),
    ]);
  }
  return {
    success: true as const,
    entry: await readEntry(db, userUuid, postId),
    historyEnabled: await readHistoryEnabled(db, userUuid),
  };
}
