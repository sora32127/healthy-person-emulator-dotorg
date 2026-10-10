import { useEffect, useRef, useState } from "react";
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
  const clearDialog = useRef<HTMLDialogElement>(null);
  const clearPending = useRef(false);
  const clearBusy = clear.state !== "idle";
  const settingsBusy = settings.state !== "idle" || clearBusy;
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
    if (confirmClear && !clearDialog.current?.open) clearDialog.current?.showModal();
  }, [confirmClear]);

  useEffect(() => {
    if (clear.state !== "idle") return;
    clearPending.current = false;
    if (clear.data?.success) {
      clearDialog.current?.close();
      setConfirmClear(false);
    }
  }, [clear.state, clear.data]);

  function closeClearDialog() {
    if (clearPending.current || clearBusy) return;
    clearDialog.current?.close();
    setConfirmClear(false);
  }

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
          <p role="status" className="text-sm">
            履歴の記録：<strong>{enabled ? "有効" : "無効"}</strong>
          </p>
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
          <button
            type="button"
            className="btn btn-ghost btn-sm shadow-none"
            onClick={() => setConfirmClear(true)}
            disabled={settingsBusy}
          >
            履歴を消去
          </button>
        </div>
        {settings.data?.success === false && (
          <p role="alert" className="mt-2 text-sm text-error">
            {settings.data.error}
          </p>
        )}
        {confirmClear && (
          <dialog
            ref={clearDialog}
            className="modal"
            aria-labelledby="history-clear-title"
            aria-describedby="history-clear-description"
            onCancel={(event) => {
              event.preventDefault();
              closeClearDialog();
            }}
            onClose={() => setConfirmClear(false)}
          >
            <div className="modal-box shadow-none">
              <h2 id="history-clear-title" className="font-bold text-lg">
                履歴を消去しますか？
              </h2>
              <p id="history-clear-description" className="py-2 text-sm opacity-70">
                すべての履歴を消去します。
              </p>
              <clear.Form
                method="post"
                action="/api/library"
                onSubmit={(event) => {
                  if (clearPending.current || settingsBusy) {
                    event.preventDefault();
                    return;
                  }
                  clearPending.current = true;
                }}
              >
                <input type="hidden" name="intent" value="clearHistory" />
                {clear.data?.success === false && (
                  <p role="alert" className="mt-2 text-sm text-error">
                    {clear.data.error}
                  </p>
                )}
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shadow-none"
                    onClick={closeClearDialog}
                    disabled={clearBusy}
                    autoFocus
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="btn btn-error btn-sm shadow-none"
                    disabled={settingsBusy}
                  >
                    {clearBusy ? "消去中..." : "消去する"}
                  </button>
                </div>
              </clear.Form>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button
                type="button"
                aria-label="確認を閉じる"
                onClick={closeClearDialog}
                disabled={clearBusy}
              >
                閉じる
              </button>
            </form>
          </dialog>
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
