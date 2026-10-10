import { useEffect, useRef } from "react";
import { Link, useFetcher } from "react-router";
import type { LibraryEntry } from "~/modules/library.server";
import AdminLibraryEntryEditor from "./AdminLibraryEntryEditor";

type LibraryResponse = {
  success: boolean;
  entry?: LibraryEntry | null;
  historyEnabled?: boolean;
  error?: string;
};

export default function AdminLibraryArticle({ postId }: { postId: number }) {
  const fetcher = useFetcher<LibraryResponse>();
  const recordedPostId = useRef<number | null>(null);

  useEffect(() => {
    if (recordedPostId.current === postId) return;
    recordedPostId.current = postId;
    fetcher.submit(
      { intent: "recordView", postId: String(postId) },
      { method: "post", action: "/api/admin-library" },
    );
  }, [postId, fetcher.submit]);

  return (
    <section className="my-6 border-t border-base-300 pt-4" aria-label="自分用の事例集">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-bold">
          自分用の事例集 <span className="badge badge-outline badge-sm">管理者限定</span>
        </h2>
        <Link to="/admin/library" className="link link-hover text-sm">
          保存した事例・閲覧履歴を見る
        </Link>
      </div>
      {fetcher.data?.success ? (
        <>
          <AdminLibraryEntryEditor postId={postId} initialEntry={fetcher.data.entry ?? null} />
          <p className="text-sm opacity-60 mt-2">
            {fetcher.data.historyEnabled
              ? "閲覧履歴をクラウドに記録しています。"
              : "閲覧履歴の記録は停止中です。"}
          </p>
        </>
      ) : fetcher.data?.error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-error text-sm">
            {fetcher.data.error}
          </p>
          <fetcher.Form method="post" action="/api/admin-library">
            <input type="hidden" name="intent" value="recordView" />
            <input type="hidden" name="postId" value={postId} />
            <button
              type="submit"
              className="btn btn-outline btn-sm"
              disabled={fetcher.state !== "idle"}
            >
              再試行
            </button>
          </fetcher.Form>
        </div>
      ) : (
        <p className="text-sm opacity-60" role="status">
          読み込み中...
        </p>
      )}
    </section>
  );
}
