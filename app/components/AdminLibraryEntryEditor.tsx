import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { LibraryEntry } from "~/modules/library.server";

export type LibraryMutationResult =
  | { success: true; entry?: LibraryEntry | null; historyEnabled?: boolean }
  | { success: false; error: string };

export default function AdminLibraryEntryEditor({
  postId,
  initialEntry,
}: {
  postId: number;
  initialEntry: LibraryEntry | null;
}) {
  const saved = useFetcher<LibraryMutationResult>();
  const memo = useFetcher<LibraryMutationResult>();
  const [isSaved, setIsSaved] = useState(initialEntry?.isSaved ?? false);
  const [note, setNote] = useState(initialEntry?.note ?? "");
  const [savedNote, setSavedNote] = useState(initialEntry?.note ?? "");
  const previousNote = useRef(initialEntry?.note ?? "");
  const previousPostId = useRef(postId);
  const noteId = useId();
  const busy = saved.state !== "idle" || memo.state !== "idle";

  useEffect(() => {
    setIsSaved(initialEntry?.isSaved ?? false);
  }, [initialEntry?.isSaved, postId]);

  useEffect(() => {
    const nextNote = initialEntry?.note ?? "";
    const lastNote = previousNote.current;
    const changedPost = previousPostId.current !== postId;
    setNote((current) => (changedPost || current === lastNote ? nextNote : current));
    setSavedNote(nextNote);
    previousNote.current = nextNote;
    previousPostId.current = postId;
  }, [initialEntry?.note, postId]);

  useEffect(() => {
    if (saved.state === "idle" && saved.data?.success) {
      setIsSaved(saved.data.entry?.isSaved ?? false);
    }
  }, [saved.state, saved.data]);

  useEffect(() => {
    if (memo.state === "idle" && memo.data?.success) {
      const nextNote = memo.data.entry?.note ?? "";
      setNote(nextNote);
      setSavedNote(nextNote);
      previousNote.current = nextNote;
    }
  }, [memo.state, memo.data]);

  return (
    <div className="space-y-3">
      <saved.Form
        method="post"
        action="/api/admin-library"
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="intent" value="setSaved" />
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="isSaved" value={String(!isSaved)} />
        <button
          type="submit"
          className={`btn btn-sm ${isSaved ? "btn-secondary" : "btn-primary"}`}
          aria-pressed={isSaved}
          disabled={busy}
        >
          {saved.state !== "idle" ? "更新中..." : isSaved ? "保存を解除" : "保存する"}
        </button>
        {saved.state === "idle" && saved.data?.success && (
          <p role="status" className="text-sm opacity-70">
            {isSaved ? "保存しました。" : "保存を解除しました。"}
          </p>
        )}
        {saved.data?.success === false && (
          <p role="alert" className="text-sm text-error">
            {saved.data.error}
          </p>
        )}
      </saved.Form>

      <memo.Form method="post" action="/api/admin-library" className="space-y-2">
        <input type="hidden" name="intent" value="saveNote" />
        <input type="hidden" name="postId" value={postId} />
        <label htmlFor={noteId} className="block text-sm font-medium">
          自分用のメモ
        </label>
        <textarea
          id={noteId}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          className="textarea textarea-bordered w-full leading-relaxed"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={busy || note === savedNote}
          >
            {memo.state !== "idle" ? "保存中..." : "メモを保存"}
          </button>
          <span className="text-xs opacity-60">{note.length} / 2000文字</span>
          {memo.state === "idle" && memo.data?.success && note === savedNote && (
            <p role="status" className="text-sm opacity-70">
              メモを保存しました。
            </p>
          )}
        </div>
        {memo.data?.success === false && (
          <p role="alert" className="text-sm text-error">
            {memo.data.error}
          </p>
        )}
      </memo.Form>
    </div>
  );
}
