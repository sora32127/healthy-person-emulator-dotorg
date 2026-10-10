import { redirect } from "react-router";
import { and, count, desc, eq, exists, gte, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  dimComments,
  dimPosts,
  dimTags,
  relPostTags,
  userLibraryEntries,
  userLibraryReactions,
  userLibrarySettings,
} from "../drizzle/schema";
import { isLibraryEnabledForUser } from "./feature-flags.server";
import { getAuthenticatedUser } from "./auth.google.server";

export type LibraryTimelineEvent = {
  postId: number;
  postTitle: string;
  kind: "view" | "like" | "dislike" | "comment_like" | "comment_dislike";
  occurredAt: string;
  commentId: number | null;
};

const PAGE_SIZE = 50;
const HISTORY_LIMIT = 500;
const HISTORY_DAYS = 90;
const VIEW_INTERVAL_MS = 30 * 60 * 1000;
type LibraryDb = ReturnType<typeof drizzle>;

export class LibraryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getDb() {
  const db = (globalThis as any).__cloudflareEnv?.DB as D1Database | undefined;
  if (!db) throw new Error("DB is not configured");
  return drizzle(db);
}

async function requireLibraryUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new LibraryError(401, "ログインが必要です");
  if (!isLibraryEnabledForUser(user)) throw new LibraryError(403, "この機能は現在利用できません");
  return user;
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

async function readHistoryEnabled(db: LibraryDb, userUuid: string): Promise<boolean> {
  const setting = await db
    .select({ enabled: userLibrarySettings.historyEnabled })
    .from(userLibrarySettings)
    .where(eq(userLibrarySettings.userUuid, userUuid))
    .get();
  return setting?.enabled ?? true;
}

async function assertPostExists(db: LibraryDb, postId: number) {
  const post = await db
    .select({ postId: dimPosts.postId })
    .from(dimPosts)
    .where(eq(dimPosts.postId, postId))
    .get();
  if (!post) throw new LibraryError(404, "記事が見つかりません");
}

function historyEvents(db: LibraryDb, userUuid: string, cutoff: string) {
  return db.$with("history_events").as(
    db
      .select({
        postId: userLibraryEntries.postId,
        kind: sql<LibraryTimelineEvent["kind"]>`'view'`.as("event_kind"),
        occurredAt: sql<string>`${userLibraryEntries.lastViewedAt}`.as("event_occurred_at"),
        targetId: sql<number>`${userLibraryEntries.postId}`.as("event_target_id"),
        commentId: sql<number | null>`NULL`.as("event_comment_id"),
      })
      .from(userLibraryEntries)
      .where(
        and(
          eq(userLibraryEntries.userUuid, userUuid),
          gte(userLibraryEntries.lastViewedAt, cutoff),
        ),
      )
      .unionAll(
        db
          .select({
            postId: userLibraryReactions.postId,
            kind: userLibraryReactions.kind,
            occurredAt: userLibraryReactions.occurredAt,
            targetId: userLibraryReactions.targetId,
            commentId: userLibraryReactions.commentId,
          })
          .from(userLibraryReactions)
          .where(
            and(
              eq(userLibraryReactions.userUuid, userUuid),
              gte(userLibraryReactions.occurredAt, cutoff),
            ),
          ),
      ),
  );
}

export async function getLibraryPage(request: Request, options: { query: string; page: number }) {
  const user = await getAuthenticatedUser(request);
  if (!user || !isLibraryEnabledForUser(user)) throw redirect("/");
  const db = getDb();
  const events = historyEvents(db, user.userUuid, historyCutoff());
  const pattern = `%${options.query.replace(/[\\%_]/g, "\\$&")}%`;
  const filteredEvents = db
    .select({
      postId: events.postId,
      postTitle: dimPosts.postTitle,
      kind: events.kind,
      occurredAt: events.occurredAt,
      commentId: events.commentId,
      targetId: events.targetId,
    })
    .from(events)
    .innerJoin(dimPosts, eq(dimPosts.postId, events.postId))
    .leftJoin(
      dimComments,
      and(eq(dimComments.commentId, events.commentId), eq(dimComments.postId, events.postId)),
    )
    .where(
      options.query
        ? or(
            sql`${dimPosts.postTitle} LIKE ${pattern} ESCAPE '\\'`,
            sql`${dimPosts.postContent} LIKE ${pattern} ESCAPE '\\'`,
            sql`${dimComments.commentContent} LIKE ${pattern} ESCAPE '\\'`,
            exists(
              db
                .select({ tagId: dimTags.tagId })
                .from(relPostTags)
                .innerJoin(dimTags, eq(dimTags.tagId, relPostTags.tagId))
                .where(
                  and(
                    eq(relPostTags.postId, events.postId),
                    sql`${dimTags.tagName} LIKE ${pattern} ESCAPE '\\'`,
                  ),
                ),
            ),
          )
        : undefined,
    )
    .as("filtered_events");
  const [result, historyEnabled] = await Promise.all([
    db.with(events).select({ total: count() }).from(filteredEvents).get(),
    readHistoryEnabled(db, user.userUuid),
  ]);
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    totalPages,
    Number.isSafeInteger(options.page) && options.page > 0 ? options.page : 1,
  );
  const rows = await db
    .with(events)
    .select({
      postId: filteredEvents.postId,
      postTitle: filteredEvents.postTitle,
      kind: filteredEvents.kind,
      occurredAt: filteredEvents.occurredAt,
      commentId: filteredEvents.commentId,
    })
    .from(filteredEvents)
    .orderBy(
      desc(filteredEvents.occurredAt),
      desc(filteredEvents.postId),
      desc(filteredEvents.kind),
      desc(filteredEvents.targetId),
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { entries: rows, page, totalPages, total, historyEnabled };
}

function pruneHistory(db: LibraryDb, userUuid: string, now: Date) {
  const events = historyEvents(db, userUuid, historyCutoff(now));
  const keep = db
    .$with("retained_history")
    .as(
      db
        .select({ kind: events.kind, targetId: events.targetId })
        .from(events)
        .orderBy(
          desc(events.occurredAt),
          desc(events.postId),
          desc(events.kind),
          desc(events.targetId),
        )
        .limit(HISTORY_LIMIT),
    );
  return [
    db
      .with(events, keep)
      .delete(userLibraryEntries)
      .where(
        and(
          eq(userLibraryEntries.userUuid, userUuid),
          notExists(
            db
              .select()
              .from(keep)
              .where(and(eq(keep.kind, "view"), eq(keep.targetId, userLibraryEntries.postId))),
          ),
        ),
      ),
    db
      .with(events, keep)
      .delete(userLibraryReactions)
      .where(
        and(
          eq(userLibraryReactions.userUuid, userUuid),
          notExists(
            db
              .select()
              .from(keep)
              .where(
                and(
                  eq(keep.kind, userLibraryReactions.kind),
                  eq(keep.targetId, userLibraryReactions.targetId),
                ),
              ),
          ),
        ),
      ),
  ] as const;
}

function historyRecordingAllowed(db: LibraryDb, userUuid: string) {
  return notExists(
    db
      .select({ userUuid: userLibrarySettings.userUuid })
      .from(userLibrarySettings)
      .where(
        and(
          eq(userLibrarySettings.userUuid, userUuid),
          eq(userLibrarySettings.historyEnabled, false),
        ),
      ),
  );
}

export async function recordLibraryReaction(
  request: Request,
  reaction: { postId: number; voteType: "like" | "dislike"; commentId?: number },
): Promise<void> {
  const user = await getAuthenticatedUser(request);
  if (!user || !isLibraryEnabledForUser(user)) return;
  assertSameOriginPost(request);
  const { postId, voteType } = reaction;
  const commentId = reaction.commentId ?? null;
  const db = getDb();
  if (!(await readHistoryEnabled(db, user.userUuid))) return;
  if (commentId !== null) {
    const comment = await db
      .select({ commentId: dimComments.commentId })
      .from(dimComments)
      .where(and(eq(dimComments.commentId, commentId), eq(dimComments.postId, postId)))
      .get();
    if (!comment) throw new LibraryError(404, "コメントが見つかりません");
  }
  const kind = commentId === null ? voteType : (`comment_${voteType}` as const);
  const targetId = commentId ?? postId;
  const current = await db
    .select({ occurredAt: userLibraryReactions.occurredAt })
    .from(userLibraryReactions)
    .where(
      and(
        eq(userLibraryReactions.userUuid, user.userUuid),
        eq(userLibraryReactions.kind, kind),
        eq(userLibraryReactions.targetId, targetId),
      ),
    )
    .get();
  const now = new Date();
  if (current && now.getTime() - Date.parse(current.occurredAt) < VIEW_INTERVAL_MS) return;
  await db.batch([
    db
      .insert(userLibraryReactions)
      .select(
        db
          .select({
            userUuid: sql<string>`${user.userUuid}`.as("user_uuid"),
            postId: dimPosts.postId,
            commentId: sql<number | null>`${commentId}`.as("comment_id"),
            kind: sql<typeof kind>`${kind}`.as("kind"),
            targetId: sql<number>`${targetId}`.as("target_id"),
            occurredAt: sql<string>`${now.toISOString()}`.as("occurred_at"),
          })
          .from(dimPosts)
          .where(and(eq(dimPosts.postId, postId), historyRecordingAllowed(db, user.userUuid))),
      )
      .onConflictDoUpdate({
        target: [
          userLibraryReactions.userUuid,
          userLibraryReactions.kind,
          userLibraryReactions.targetId,
        ],
        set: { occurredAt: now.toISOString() },
        setWhere: lte(
          userLibraryReactions.occurredAt,
          new Date(now.getTime() - VIEW_INTERVAL_MS).toISOString(),
        ),
      }),
    ...pruneHistory(db, user.userUuid, now),
  ]);
}

export async function mutateLibrary(request: Request) {
  const user = await requireLibraryUser(request);
  assertSameOriginPost(request);
  let formData: FormData;
  try {
    formData = await request.formData();
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
    const enabled = formData.get("enabled");
    if (enabled !== "true" && enabled !== "false") throw new LibraryError(400, "設定値が不正です");
    await db
      .insert(userLibrarySettings)
      .values({ userUuid, historyEnabled: enabled === "true" })
      .onConflictDoUpdate({
        target: userLibrarySettings.userUuid,
        set: { historyEnabled: enabled === "true" },
      });
    return { success: true as const };
  }
  if (intent === "clearHistory") {
    await db.batch([
      db.delete(userLibraryEntries).where(eq(userLibraryEntries.userUuid, userUuid)),
      db.delete(userLibraryReactions).where(eq(userLibraryReactions.userUuid, userUuid)),
    ]);
    return { success: true as const };
  }

  const postId = Number(formData.get("postId"));
  if (!Number.isSafeInteger(postId) || postId <= 0) throw new LibraryError(400, "記事IDが不正です");
  await assertPostExists(db, postId);
  const now = new Date();
  const [historyEnabled, viewed] = await Promise.all([
    readHistoryEnabled(db, userUuid),
    db
      .select({ viewedAt: userLibraryEntries.lastViewedAt })
      .from(userLibraryEntries)
      .where(and(eq(userLibraryEntries.userUuid, userUuid), eq(userLibraryEntries.postId, postId)))
      .get(),
  ]);
  if (
    !historyEnabled ||
    (viewed?.viewedAt && now.getTime() - Date.parse(viewed.viewedAt) < VIEW_INTERVAL_MS)
  ) {
    return { success: true as const };
  }
  await db.batch([
    db
      .insert(userLibraryEntries)
      .select(
        db
          .select({
            userUuid: sql<string>`${userUuid}`.as("user_uuid"),
            postId: dimPosts.postId,
            lastViewedAt: sql<string>`${now.toISOString()}`.as("last_viewed_at"),
          })
          .from(dimPosts)
          .where(and(eq(dimPosts.postId, postId), historyRecordingAllowed(db, userUuid))),
      )
      .onConflictDoUpdate({
        target: [userLibraryEntries.userUuid, userLibraryEntries.postId],
        set: { lastViewedAt: now.toISOString() },
        setWhere: or(
          isNull(userLibraryEntries.lastViewedAt),
          lte(
            userLibraryEntries.lastViewedAt,
            new Date(now.getTime() - VIEW_INTERVAL_MS).toISOString(),
          ),
        ),
      }),
    ...pruneHistory(db, userUuid, now),
  ]);
  return { success: true as const };
}
