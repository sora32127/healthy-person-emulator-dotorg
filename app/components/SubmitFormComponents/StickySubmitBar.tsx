export default function StickySubmitBar({
  onClick,
  isLoading,
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isLoading: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 bg-base-100 border-t border-base-200 py-3 px-4 flex justify-center">
      <button
        type="submit"
        className="btn btn-primary btn-wide"
        onClick={onClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="loading loading-spinner loading-sm" />
            プレビュー取得中...
          </>
        ) : (
          'プレビューする'
        )}
      </button>
    </div>
  );
}
