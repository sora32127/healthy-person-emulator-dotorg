import { useEffect, useState } from "react";
import {
  data,
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigationType,
} from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getLibraryPage } from "~/modules/library.server";
import { H1 } from "~/components/Headings";
import { CommonNavLink } from "~/components/CommonNavLink";

type HistoryMutationResult = {
  success: boolean;
  historyEnabled?: boolean;
  error?: string;
};

export const meta: MetaFunction = () => [
  { title: "履歴 | 健常者エミュレータ事例集" },
  { name: "robots", content: "noindex, nofollow" },
];

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const requestedPage = Number(url.searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const library = await getLibraryPage(request, { query, page });
  return data({ ...library, query }, { headers: { "Cache-Control": "private, no-store" } });
}

function formatDate(value: string | null) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

export default function History() {
  const { entries, page, totalPages, total, historyEnabled, query } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [search, setSearch] = useState(query);
  const [isComposing, setIsComposing] = useState(false);
  const settings = useFetcher<HistoryMutationResult>();
  const clear = useFetcher<HistoryMutationResult>();
  const [confirmClear, setConfirmClear] = useState(false);
  const settingsBusy = settings.state !== "idle" || clear.state !== "idle";
  const enabled = historyEnabled;

  useEffect(() => {
    if (navigationType !== "REPLACE") setSearch(query);
  }, [navigationType, query]);

  useEffect(() => {
    if (isComposing || search.trim() === query) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      void navigate(`/history${params.size ? `?${params}` : ""}`, {
        replace: true,
        preventScrollReset: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isComposing, search, query, navigate]);

  useEffect(() => {
    if (clear.state === "idle" && clear.data?.success) setConfirmClear(false);
  }, [clear.state, clear.data]);

  function pageUrl(nextPage: number) {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (query) params.set("q", query);
    return `/history?${params}`;
  }

  return (
    <div>
      <H1>履歴</H1>
      <p className="mb-4 text-sm text-base-content/70">{total}件</p>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <settings.Form method="post" action="/api/library">
            <input type="hidden" name="intent" value="setHistoryEnabled" />
            <input type="hidden" name="enabled" value={String(!enabled)} />
            <button
              type="submit"
              className="btn btn-ghost btn-sm shadow-none"
              disabled={settingsBusy}
            >
              {settings.state !== "idle"
                ? "更新中..."
                : enabled
                  ? "履歴を無効にする"
                  : "履歴を有効にする"}
            </button>
          </settings.Form>
          {!confirmClear && (
            <button
              type="button"
              className="btn btn-ghost btn-sm shadow-none"
              onClick={() => setConfirmClear(true)}
              disabled={settingsBusy}
            >
              履歴を消去
            </button>
          )}
        </div>
        {settings.data?.success === false && (
          <p role="alert" className="mt-2 text-sm text-error">
            {settings.data.error}
          </p>
        )}
        {confirmClear && (
          <clear.Form method="post" action="/api/library" className="mt-3 space-y-2">
            <input type="hidden" name="intent" value="clearHistory" />
            <p className="text-sm">履歴をすべて消去しますか？</p>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-error btn-sm shadow-none"
                disabled={settingsBusy}
              >
                {clear.state !== "idle" ? "消去中..." : "履歴をすべて消去する"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm shadow-none"
                onClick={() => setConfirmClear(false)}
                disabled={settingsBusy}
              >
                キャンセル
              </button>
            </div>
          </clear.Form>
        )}
        {clear.data?.success === false && (
          <p role="alert" className="mt-2 text-sm text-error">
            {clear.data.error}
          </p>
        )}
      </div>

      <input
        name="q"
        type="search"
        aria-label="履歴を検索"
        placeholder="検索"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        maxLength={200}
        className="input input-bordered mb-4 w-full shadow-none"
      />

      {entries.length === 0 ? (
        <p className="py-4 text-sm opacity-70">
          {query ? "該当する履歴はありません。" : "履歴はありません。"}
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={`${entry.kind}:${entry.postId}:${entry.commentId ?? ""}`}>
              <p className="mb-1 text-xs opacity-60">
                {{
                  view: "閲覧",
                  like: "いいね",
                  dislike: "良くないね",
                  comment_like: "コメントを評価",
                  comment_dislike: "コメントを逆評価",
                }[entry.kind]} ·{" "}
                <time dateTime={entry.occurredAt ?? undefined}>{formatDate(entry.occurredAt)}</time>
              </p>
              <h2 className="text-lg font-bold break-words">
                <CommonNavLink
                  to={`/archives/${entry.postId}${entry.commentId ? `#comment-${entry.commentId}` : ""}`}
                >
                  {entry.postTitle}
                </CommonNavLink>
              </h2>
              {entry.commentContent && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{entry.commentContent}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="履歴のページ" className="join mt-4 flex justify-center">
          {page > 1 && (
            <Link to={pageUrl(page - 1)} className="join-item btn btn-sm shadow-none">
              前へ
            </Link>
          )}
          <span className="join-item btn btn-sm btn-disabled shadow-none">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link to={pageUrl(page + 1)} className="join-item btn btn-sm shadow-none">
              次へ
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
