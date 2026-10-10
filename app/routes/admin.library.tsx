import { useEffect, useState } from "react";
import { data, Form, Link, useFetcher, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import AdminLibraryEntryEditor from "~/components/AdminLibraryEntryEditor";
import type { LibraryMutationResult } from "~/components/AdminLibraryEntryEditor";
import { requireAdmin } from "~/modules/admin.server";
import { getLibraryPage } from "~/modules/library.server";

export const meta: MetaFunction = () => [
  { title: "自分用の事例集 | 管理画面" },
  { name: "robots", content: "noindex, nofollow" },
];

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "history" ? "history" : "saved";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const requestedPage = Number(url.searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const library = await getLibraryPage(request, { view, query, page });
  return data({ ...library, view, query }, { headers: { "Cache-Control": "private, no-store" } });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

export default function AdminLibrary() {
  const { entries, page, totalPages, total, historyEnabled, view, query } =
    useLoaderData<typeof loader>();
  const settings = useFetcher<LibraryMutationResult>();
  const clear = useFetcher<LibraryMutationResult>();
  const [confirmClear, setConfirmClear] = useState(false);
  const settingsBusy = settings.state !== "idle" || clear.state !== "idle";
  const enabled = historyEnabled;

  useEffect(() => {
    if (clear.state === "idle" && clear.data?.success) setConfirmClear(false);
  }, [clear.state, clear.data]);

  function pageUrl(nextPage: number) {
    return `/admin/library?${new URLSearchParams({ view, q: query, page: String(nextPage) })}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">自分用の事例集 ({total}件)</h1>
      <p className="mb-4 text-sm opacity-70">
        管理者限定の試作です。保存した事例・メモ・閲覧履歴は、自分のアカウントに保存されます。
      </p>

      <div className="mb-6 border border-base-300 bg-base-100 p-4">
        <h2 className="mb-2 font-bold">閲覧履歴</h2>
        <p className="mb-3 text-sm opacity-70">
          有効にすると、これから開く事例をクラウドに記録し、直近90日・最大500件を表示します。無効にしても保存済みの事例やメモは残ります。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <settings.Form method="post" action="/api/admin-library">
            <input type="hidden" name="intent" value="setHistoryEnabled" />
            <input type="hidden" name="enabled" value={String(!enabled)} />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={settingsBusy}>
              {settings.state !== "idle"
                ? "更新中..."
                : enabled
                  ? "履歴を無効にする"
                  : "履歴を有効にする"}
            </button>
          </settings.Form>
          <span className="text-sm">現在: {enabled ? "有効" : "無効"}</span>
          {!confirmClear && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
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
        {settings.state === "idle" && settings.data?.success && (
          <p role="status" className="mt-2 text-sm opacity-70">
            履歴の設定を更新しました。
          </p>
        )}
        {confirmClear && (
          <clear.Form method="post" action="/api/admin-library" className="mt-3 space-y-2">
            <input type="hidden" name="intent" value="clearHistory" />
            <p className="text-sm">閲覧履歴をすべて消去しますか？ 保存した事例とメモは残ります。</p>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-error btn-sm" disabled={settingsBusy}>
                {clear.state !== "idle" ? "消去中..." : "履歴をすべて消去する"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
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
        {clear.state === "idle" && clear.data?.success && !confirmClear && (
          <p role="status" className="mt-2 text-sm opacity-70">
            閲覧履歴を消去しました。
          </p>
        )}
      </div>

      <Form method="get" className="mb-4 flex flex-wrap items-end gap-3" key={`${view}:${query}`}>
        <label className="space-y-1">
          <span className="block text-sm">表示</span>
          <select name="view" defaultValue={view} className="select select-bordered">
            <option value="saved">保存・メモ</option>
            <option value="history">閲覧履歴</option>
          </select>
        </label>
        <label className="flex-1 min-w-48 space-y-1">
          <span className="block text-sm">タイトル・メモから検索</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            maxLength={200}
            className="input input-bordered w-full"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          表示する
        </button>
      </Form>

      {entries.length === 0 ? (
        <p className="py-4 text-sm opacity-70">
          {query
            ? "検索条件に一致する事例はありません。"
            : view === "saved"
              ? "保存した事例やメモはありません。事例ページから追加できます。"
              : "閲覧履歴はありません。履歴を有効にして事例ページを開くと追加されます。"}
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.postId} className="border border-base-300 bg-base-100 p-4">
              <h2 className="mb-2 text-lg font-bold break-words">
                <Link to={`/archives/${entry.postId}`} className="link link-hover">
                  {entry.postTitle}
                </Link>
              </h2>
              <p className="mb-3 text-xs opacity-60">
                {view === "history"
                  ? `最終閲覧: ${formatDate(entry.lastViewedAt)}（日本時間）`
                  : entry.isSaved
                    ? `保存日時: ${formatDate(entry.savedAt)}（日本時間）`
                    : "メモ付きの事例"}
              </p>
              <AdminLibraryEntryEditor postId={entry.postId} initialEntry={entry} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="事例集のページ" className="join mt-4 flex justify-center">
          {page > 1 && (
            <Link to={pageUrl(page - 1)} className="join-item btn btn-sm">
              前へ
            </Link>
          )}
          <span className="join-item btn btn-sm btn-disabled">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link to={pageUrl(page + 1)} className="join-item btn btn-sm">
              次へ
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
