import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

type LibraryResponse = {
  success: boolean;
};

export default function LibraryArticle({ postId }: { postId: number }) {
  const fetcher = useFetcher<LibraryResponse>();
  const recordedPostId = useRef<number | null>(null);

  useEffect(() => {
    if (recordedPostId.current === postId) return;
    recordedPostId.current = postId;
    fetcher.submit(
      { intent: "recordView", postId: String(postId) },
      { method: "post", action: "/api/library" },
    );
  }, [postId, fetcher.submit]);

  useEffect(() => {
    if (fetcher.data?.success === false) console.warn("閲覧履歴を記録できませんでした。");
  }, [fetcher.data]);

  return null;
}
