import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

export default function LibraryArticle({ postId }: { postId: number }) {
  const fetcher = useFetcher();
  const recordedPostId = useRef<number | null>(null);

  useEffect(() => {
    if (recordedPostId.current === postId) return;
    recordedPostId.current = postId;
    fetcher.submit(
      { intent: "recordView", postId: String(postId) },
      { method: "post", action: "/api/library", defaultShouldRevalidate: false },
    );
  }, [postId, fetcher.submit]);

  return null;
}
