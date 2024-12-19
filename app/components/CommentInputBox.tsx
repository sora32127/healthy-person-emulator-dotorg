import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useForm } from "react-hook-form";

const commentFormSchema = z.object({
  commentAuthor: z.string().min(1, { message: "名前は必須です" }),
  commentContent: z.string().min(1, { message: "コメントを入力してください" }),
  turnstileToken: z.string().refine((value) => value.length > 0, { message: "時間をおいて再度投稿してください" }),
  commentParentId: z.number().optional(),
  postId: z.number().optional()
});

export type CommentFormInputs = z.infer<typeof commentFormSchema>;

interface CommentInputBoxProps {
  onSubmit: (data: CommentFormInputs) => void;
  isCommentOpen: boolean;
  commentParentId: number;
  CF_TURNSTILE_SITE_KEY: string;
}

export default function CommentInputBox({
  onSubmit,
  isCommentOpen,
  commentParentId,
  CF_TURNSTILE_SITE_KEY,
}: CommentInputBoxProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<CommentFormInputs>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      commentAuthor: "Anonymous",
      commentContent: "",
      commentParentId: 0
    }
  });

  const handleCommentSubmit = async (data: CommentFormInputs) => {
    setValue("commentParentId", commentParentId)
    await onSubmit(data);
    reset();
  };

  if (!isCommentOpen) {
    return <p>この記事に対するコメントは現在停止中です</p>;
  }

  const [isValidUser, setIsValidUser] = useState(false);

  const handleTurnStileSuccess = (token: string) => {
    setValue("turnstileToken", token);
    setIsValidUser(true);
  }

  return (
    <form onSubmit={handleSubmit(handleCommentSubmit)} className="space-y-4">
      <div>
        <input
          {...register("commentAuthor")}
          placeholder="名前"
          className="input input-bordered w-full"
          defaultValue="Anonymous"
        />
        {errors.commentAuthor && (
          <p className="text-red-500 text-sm">{errors.commentAuthor.message}</p>
        )}
      </div>
      <div>
        <textarea
          {...register("commentContent")}
          placeholder="コメントを入力"
          className="textarea textarea-bordered w-full"
          rows={4}
        />
        {errors.commentContent && (
          <p className="text-red-500 text-sm">{errors.commentContent.message}</p>
        )}
      </div>

      <Turnstile
        siteKey={CF_TURNSTILE_SITE_KEY}
        onSuccess={handleTurnStileSuccess}
      />

      <button type="submit" className={
        `btn w-full ${!isValidUser ? "animate-pulse btn-disabled" : ""}
        ${isValidUser ? "btn-primary" : ""}
        `
        }>
        コメントを投稿
      </button>
    </form>
  );
}