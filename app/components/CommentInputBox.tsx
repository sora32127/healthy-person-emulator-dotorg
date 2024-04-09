// CommentInputBox.tsx
import { Form } from "@remix-run/react";

interface CommentInputBoxProps {
  commentAuthor: string;
  commentContent: string;
  onCommentAuthorChange: (value: string) => void;
  onCommentContentChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isCommentOpen: boolean;
  commentParentId: number;
}

export default function CommentInputBox({
  commentAuthor,
  commentContent,
  onCommentAuthorChange,
  onCommentContentChange,
  onSubmit,
  isCommentOpen,
  commentParentId,
}: CommentInputBoxProps) {
  return (
    <Form onSubmit={onSubmit} preventScrollReset>
      <div className="mb-4">
        <label htmlFor="commentAuthor" className="block mb-2">
          名前
        </label>
        <input
          type="text"
          id="commentAuthor"
          value={commentAuthor}
          onChange={(e) => onCommentAuthorChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="commentContent" className="block mb-2">
          {"コメント"}
        </label>
        <textarea
          id="commentContent"
          value={commentContent}
          onChange={(e) => onCommentContentChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
        ></textarea>
      </div>
      <button
        type="submit"
        className={`px-4 py-2 mx-1 w-full ${
          isCommentOpen
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        } rounded`}
        disabled={!isCommentOpen}
      >
        {"コメント"}
      <input type="hidden" name="commentParentId" value={commentParentId} />
      </button>
    </Form>
  );
}
