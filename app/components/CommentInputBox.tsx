import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";

const commentFormSchema = z.object({
  commentAuthor: z.string().min(1, { message: "名前は必須です" }),
  commentContent: z.string().min(1, { message: "コメントを入力してください" }),
  commentParentId: z.number().optional(),
  postId: z.number().optional()
});

export type CommentFormInputs = z.infer<typeof commentFormSchema>;

interface CommentInputBoxProps {
  onSubmit: (data: CommentFormInputs) => void;
  isCommentOpen: boolean;
  commentParentId: number | undefined;
}

export default function CommentInputBox({
  onSubmit,
  isCommentOpen,
  commentParentId,
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
      commentParentId: commentParentId ?? 0
    }
  });

  const handleCommentSubmit = async (data: CommentFormInputs) => {
    setValue("commentParentId", commentParentId)
    onSubmit(data);
    reset();
  };

  if (!isCommentOpen) {
    return <p>この記事に対するコメントは現在停止中です</p>;
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
      <button type="submit" className="btn w-full btn-primary">
        コメントを投稿
      </button>
    </form>
  );
}