import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryArticle from "./LibraryArticle";

const fetcher = vi.hoisted(() => ({
  submit: vi.fn(),
  data: undefined as { success: boolean } | undefined,
}));

vi.mock("react-router", () => ({ useFetcher: () => fetcher }));

describe("自動の閲覧履歴記録", () => {
  afterEach(() => {
    cleanup();
    fetcher.data = undefined;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("追加の画面操作なしで記事を一度記録し、別の記事への移動を記録する", () => {
    const { container, rerender } = render(
      <StrictMode>
        <LibraryArticle postId={42} />
      </StrictMode>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetcher.submit).toHaveBeenCalledOnce();
    expect(fetcher.submit).toHaveBeenLastCalledWith(
      { intent: "recordView", postId: "42" },
      { method: "post", action: "/api/library" },
    );

    rerender(
      <StrictMode>
        <LibraryArticle postId={42} />
      </StrictMode>,
    );
    expect(fetcher.submit).toHaveBeenCalledOnce();
    rerender(
      <StrictMode>
        <LibraryArticle postId={43} />
      </StrictMode>,
    );
    expect(fetcher.submit).toHaveBeenCalledTimes(2);
    expect(fetcher.submit).toHaveBeenLastCalledWith(
      { intent: "recordView", postId: "43" },
      { method: "post", action: "/api/library" },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("記録に失敗しても再試行などの操作を求める画面を足さない", () => {
    fetcher.data = { success: false };
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<LibraryArticle postId={42} />);
    expect(container).toBeEmptyDOMElement();
    expect(warning).toHaveBeenCalledWith("閲覧履歴を記録できませんでした。");
  });
});
