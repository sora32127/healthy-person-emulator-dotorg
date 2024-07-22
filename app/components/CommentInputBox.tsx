// CommentInputBox.tsx
import { Turnstile } from "@marsidev/react-turnstile";
import { Form } from "@remix-run/react";
import { useState } from "react";

interface CommentInputBoxProps {
  commentAuthor: string;
  commentContent: string;
  onCommentAuthorChange: (value: string) => void;
  onCommentContentChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isCommentOpen: boolean;
  commentParentId: number;
  CF_TURNSTILE_SITEKEY: string;
}

export default function CommentInputBox({
  commentAuthor,
  commentContent,
  onCommentAuthorChange,
  onCommentContentChange,
  onSubmit,
  isCommentOpen,
  commentParentId,
  CF_TURNSTILE_SITEKEY,
}: CommentInputBoxProps) {
  const [showError, setShowError] = useState(false);
  const [isValidUser, setIsValidUser] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentContent.trim() === "") {
      setShowError(true);
    } else {
      onSubmit(e);
      setShowError(false);
    }
  };

  const handleCommentChange = (value: string) => {
    onCommentContentChange(value);
    setShowError(false);
  };

  return (
    <Form onSubmit={handleSubmit} preventScrollReset>
      <Turnstile
        siteKey={CF_TURNSTILE_SITEKEY}
        onSuccess={() => setIsValidUser(true)}
        options={{"size":"invisible"}}
      />
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
          onChange={(e) => handleCommentChange(e.target.value)}
          className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
            showError ? "border-error text-error" : "border-gray-300 focus:ring-blue-500"
          }`}
          rows={4}
        ></textarea>
        {showError && (
          <p className="mt-1 text-sm text-error">コメントを一文字以上入力してください</p>
        )}
      </div>
      <button
        type="submit"
        className={`px-4 py-2 mx-1 w-full ${
          isCommentOpen
            ? "btn-primary"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        } rounded`}
        disabled={!isCommentOpen || !isValidUser}
      >
        {"コメント"}
        <input type="hidden" name="commentParentId" value={commentParentId} />
      </button>
    </Form>
  );
}