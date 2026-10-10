import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRoutesStub, useLoaderData, useRevalidator } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryEntryEditor from "./LibraryEntryEditor";
import type { LibraryMutationResult } from "./LibraryEntryEditor";
import type { LibraryEntry } from "~/modules/library.server";

const entry: LibraryEntry = {
  postId: 42,
  postTitle: "テスト事例",
  isSaved: false,
  note: "保存前のメモ",
  savedAt: null,
  lastViewedAt: null,
};

function renderEditor(
  initialEntry: LibraryEntry | null,
  respond: (
    form: FormData,
  ) => LibraryMutationResult | Response | Promise<LibraryMutationResult | Response>,
) {
  let currentEntry = initialEntry;
  const loader = vi.fn(() => ({ entry: currentEntry }));
  const action = vi.fn(async ({ request }: ActionFunctionArgs) =>
    respond(await request.formData()),
  );

  function EditorPage() {
    const { entry } = useLoaderData<{ entry: LibraryEntry | null }>();
    const revalidator = useRevalidator();
    return (
      <>
        <LibraryEntryEditor postId={42} initialEntry={entry} />
        <button
          type="button"
          disabled={revalidator.state !== "idle"}
          onClick={() => revalidator.revalidate()}
        >
          再取得
        </button>
      </>
    );
  }

  const Stub = createRoutesStub([
    { path: "/test", loader, Component: EditorPage },
    { path: "/api/library", action },
  ]);
  render(<Stub initialEntries={["/test"]} />);
  return {
    action,
    loader,
    setEntry(next: LibraryEntry | null) {
      currentEntry = next;
    },
  };
}

describe("LibraryEntryEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("保存中は操作を無効にし、成功後に保存状態を更新する", async () => {
    let finish!: (result: LibraryMutationResult) => void;
    const response = new Promise<LibraryMutationResult>((resolve) => {
      finish = resolve;
    });
    const received = vi.fn();
    const editor = renderEditor(null, (form) => {
      received(form);
      return response;
    });

    fireEvent.click(await screen.findByRole("button", { name: "保存する" }));
    await waitFor(() => expect(received).toHaveBeenCalledOnce());
    expect(received.mock.calls[0][0].get("postId")).toBe("42");
    expect(received.mock.calls[0][0].get("isSaved")).toBe("true");
    expect(screen.getByRole("button", { name: "更新中..." })).toBeDisabled();
    expect(screen.getByLabelText("自分用のメモ")).toBeDisabled();

    const savedEntry = { ...entry, note: "", isSaved: true, savedAt: "2026-10-10T00:00:00.000Z" };
    editor.setEntry(savedEntry);
    finish({ success: true, entry: savedEntry });

    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "保存を解除" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: "保存を解除" })).toBeEnabled();
    expect(screen.getByLabelText("自分用のメモ")).toBeEnabled();
  });

  it("メモだけの事例を未保存として表示し、保存失敗時もメモと状態を保つ", async () => {
    renderEditor(entry, () =>
      Response.json({ success: false, error: "保存できませんでした" }, { status: 500 }),
    );
    const button = await screen.findByRole("button", { name: "保存する" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("自分用のメモ")).toHaveValue("保存前のメモ");

    fireEvent.change(screen.getByLabelText("自分用のメモ"), {
      target: { value: "まだ送っていないメモ" },
    });
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("保存できませんでした");
    expect(screen.getByRole("button", { name: "保存する" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "保存する" })).toBeEnabled();
    expect(screen.getByLabelText("自分用のメモ")).toHaveValue("まだ送っていないメモ");
  });

  it("メモ保存に失敗しても入力を残し、再試行で保存できる", async () => {
    let attempts = 0;
    const editor = renderEditor(entry, (form) => {
      expect(form.get("intent")).toBe("saveNote");
      expect(form.get("note")).toBe("失敗しても残すメモ");
      if (attempts++ === 0)
        return Response.json({ success: false, error: "もう一度お試しください" }, { status: 500 });
      const next = { ...entry, note: "失敗しても残すメモ" };
      editor.setEntry(next);
      return { success: true, entry: next };
    });

    const input = await screen.findByLabelText("自分用のメモ");
    expect(input).toHaveAttribute("maxlength", "2000");
    fireEvent.change(input, { target: { value: "失敗しても残すメモ" } });
    fireEvent.click(screen.getByRole("button", { name: "メモを保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("もう一度お試しください");
    expect(input).toHaveValue("失敗しても残すメモ");
    expect(screen.getByRole("button", { name: "メモを保存" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "メモを保存" }));
    expect(await screen.findByText("メモを保存しました。")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "メモを保存" })).toBeDisabled();
  });

  it("再取得で保存済みメモを更新しつつ、編集中の入力は上書きしない", async () => {
    const editor = renderEditor(entry, () => ({ success: false, error: "未使用" }));
    const input = await screen.findByLabelText("自分用のメモ");
    editor.setEntry({ ...entry, note: "クラウド側の更新" });
    fireEvent.click(screen.getByRole("button", { name: "再取得" }));
    await waitFor(() => expect(input).toHaveValue("クラウド側の更新"));

    fireEvent.change(input, { target: { value: "編集中のメモ" } });
    editor.setEntry({ ...entry, note: "さらに更新された保存済みメモ" });
    fireEvent.click(screen.getByRole("button", { name: "再取得" }));
    await waitFor(() => expect(editor.loader).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole("button", { name: "再取得" })).toBeEnabled());
    expect(input).toHaveValue("編集中のメモ");
    expect(screen.getByRole("button", { name: "メモを保存" })).toBeEnabled();
  });
});
