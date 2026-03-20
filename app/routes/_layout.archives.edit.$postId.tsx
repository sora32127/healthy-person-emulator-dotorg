import { redirect } from 'react-router';
import { NavLink, useFetcher, useLoaderData, useNavigate } from 'react-router';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { useEffect, useState } from 'react';
import { marked } from 'marked';

import type { ActionFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import type { Tokens } from 'marked';

import {
  getNowEditingInfo,
  upsertNowEditingInfo,
  getPostForEditing,
  getTagsCounts,
  getPostEditHistory,
  updatePostWithTagsAndHistory,
  getMergeInfoBySourcePostId,
} from '~/modules/db.server';
import { H1, H2 } from '~/components/Headings';
import { MarkdownEditor } from '~/components/MarkdownEditor';
import * as diff from 'diff';
import { createEmbedding } from '~/modules/embedding.server';
import TagSelectionBox from '~/components/SubmitFormComponents/TagSelectionBox';
import { Turnstile } from '@marsidev/react-turnstile';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  getHashedUserIPAddress,
  getTurnStileSiteKey,
  validateRequest,
} from '~/modules/security.server';
import toast, { Toaster } from 'react-hot-toast';
import { MakeToastMessage } from '~/utils/makeToastMessage';
import { getAuthenticatedUser } from '~/modules/auth.google.server';

const postEditSchema = z.object({
  postTitle: z.string().min(1, 'タイトルが必要です'),
  postContent: z.string().min(10, '本文が短すぎます。'),
  tags: z.array(z.string()).min(1, 'タグが必要です'),
  userId: z.string().min(1, '無効なリクエスト：ユーザーIDが必要です'),
  turnstileToken: z.string().min(1, '認証に失敗しました。時間をおいて再度試してください。'),
});

export type PostEditSchema = z.infer<typeof postEditSchema>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userObject = await getAuthenticatedUser(request);
  const userUuid = userObject?.userUuid;
  if (!userUuid) {
    throw redirect('/');
  }

  const postIdParam = params.postId;
  const postId = Number(postIdParam);
  if (Number.isNaN(postId)) {
    throw new Response('Invalid post id', { status: 400 });
  }

  // ソース記事（統合済み）は編集不可
  const mergeInfo = await getMergeInfoBySourcePostId(postId);
  if (mergeInfo) {
    throw redirect(`/archives/${postId}`);
  }

  const nowEditingInfo = await getNowEditingInfo(postId);

  /*
  記事が編集中かどうか判断するロジックは以下の通り
  - nowEditingInfoがnullの場合、編集中でない
  - nowEditingInfoが存在し、自分が編集中の場合、編集中でない
  - nowEditingInfoが存在し、最終ロック時刻から30分以上経過している場合、編集中でない
  - それ以外の場合は編集中と判断する。つまりは以下の場合：
    - nowEditingInfoが存在する
    - なおかつ、自分以外のユーザーIDが格納されている
    - なおかつ、lastHeartBeatAtUTCから30分以内である
  */
  const isEditing =
    nowEditingInfo &&
    nowEditingInfo.userId !== userUuid &&
    new Date().getTime() - new Date(nowEditingInfo.lastHeartBeatAtUTC).getTime() < 30 * 60 * 1000;

  if (isEditing && nowEditingInfo) {
    // モーダルを表示する：${nowEditingInfo.userId}さんが編集中です。
    // 「戻る」を押してredirect(`/archives/${postId}`)する
    return {
      postData: null,
      postMarkdown: null,
      tagNames: null,
      allTagsForSearch: null,
      userUuid,
      postId: postIdParam,
      isEditing: true,
      editHistory: null,
    };
  }

  await upsertNowEditingInfo(postId, userUuid);

  const postForEdit = await getPostForEditing(postId);

  if (!postForEdit) {
    throw new Response('Post not found', { status: 404 });
  }

  const { tagNames, ...postData } = postForEdit;

  const allTagsForSearch = await getTagsCounts();

  const postMarkdown = NodeHtmlMarkdown.translate(postData.postContent);
  const editHistory = await getPostEditHistory(postId);
  const CF_TURNSTILE_SITEKEY = await getTurnStileSiteKey();

  return {
    postData,
    tagNames,
    postMarkdown,
    allTagsForSearch,
    userUuid,
    CF_TURNSTILE_SITEKEY,
    isEditing: false,
    postId: postIdParam,
    editHistory,
  };
}

export default function EditPost() {
  const {
    postData,
    postMarkdown,
    tagNames,
    allTagsForSearch,
    isEditing,
    postId,
    userUuid,
    editHistory,
    CF_TURNSTILE_SITEKEY,
  } = useLoaderData<typeof loader>();
  const [selectedTags, setSelectedTags] = useState<string[] | null>(tagNames);
  const [isSubmitButtonOpen, setIsSubmitButtonOpen] = useState(false);

  const {
    setValue,
    getValues,
    register,
    formState: { errors },
  } = useForm<PostEditSchema>({
    resolver: zodResolver(postEditSchema),
    defaultValues: {
      postTitle: postData?.postTitle ?? '',
      postContent: postMarkdown ?? '',
      tags: tagNames ?? [],
      userId: userUuid ?? '',
    },
  });

  if (isEditing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <p className="text-xl font-bold mb-4">{userUuid}さんが編集中です。</p>
          <NavLink
            to={`/archives/${postId}`}
            className="block w-full text-center text-white bg-blue-500 hover:bg-blue-600 py-2 rounded-md"
          >
            戻る
          </NavLink>
        </div>
      </div>
    );
  }

  if (!postData) {
    return <div>投稿が見つかりません</div>;
  }
  const { postTitle } = postData;
  const oldTags = tagNames;

  const handleTagsSelected = (tags: string[]) => {
    setValue('tags', tags);
    setSelectedTags(tags);
  };

  function handleTurnstileSuccess(token: string): void {
    setValue('turnstileToken', token);
    setIsSubmitButtonOpen(true);
  }

  const fetcher = useFetcher();
  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const formDataInput = getValues();
    const zodError = postEditSchema.safeParse(formDataInput);
    if (!zodError.success) {
      const toastValidationMessage = MakeToastMessage(zodError.error.issues);
      toast.error(toastValidationMessage);
      return;
    }
    const formData = new FormData();
    const inputData = getValues();
    for (const [key, value] of Object.entries(inputData)) {
      formData.append(key, value.toString());
    }
    fetcher.submit(formData, {
      method: 'post',
      action: `/archives/edit/${postId}`,
    });
  };
  const navigate = useNavigate();

  useEffect(() => {
    const response = fetcher.data as { success: boolean; message: string };
    if (fetcher.state === 'submitting') {
      setIsSubmitButtonOpen(false);
      toast.loading('投稿を編集しています。');
    }
    if (response?.success && fetcher.state === 'idle') {
      setIsSubmitButtonOpen(false);
      toast.success('投稿を編集しました。リダイレクトします...', {
        icon: '🎉',
        id: 'post-success-toast',
      });
      setTimeout(() => {
        navigate(`/archives/${postId}`, { viewTransition: true });
      }, 2000);
    }

    if (response?.success === false && fetcher.state === 'idle') {
      toast.error(response.message);
      setIsSubmitButtonOpen(true);
    }
    return () => {
      toast.dismiss();
    };
  }, [fetcher.state, fetcher.data, navigate, postId]);

  return (
    <div className="max-w-2xl mx-auto">
      <Toaster />
      <H1>投稿を編集する</H1>
      <form method="post">
        <H2>タイトルを編集する</H2>
        <p>変更前：{postData.postTitle}</p>
        <p className="my-4">変更後：</p>
        <div className="mb-4">
          <input
            type="text"
            id="postTitle"
            defaultValue={postTitle}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 edit-post-title"
            {...register('postTitle')}
          />
          {errors.postTitle && <p className="text-error">{errors.postTitle.message}</p>}
        </div>
        <div className="mb-4">
          <H2>タグを編集する</H2>
          <div className="my-4">
            <div className="mt-2">
              <p className="my-4">変更前：</p>
              <div className="flex flex-wrap">
                {oldTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2 mb-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <TagSelectionBox
            onTagsSelected={handleTagsSelected}
            parentComponentStateValues={selectedTags || []}
            allTagsOnlyForSearch={allTagsForSearch}
          />
          {errors.tags && <p className="text-error">{errors.tags.message}</p>}
          <div className="mt-2">
            <p className="my-4">変更後：</p>
            <div className="flex flex-wrap">
              {selectedTags?.map((tag) => (
                <span key={tag} className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2 mb-2">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-4">
          <H2>本文を編集する</H2>
          <MarkdownEditor
            value={getValues('postContent')}
            onChange={(value) => setValue('postContent', value)}
            register={register}
            name="postContent"
          />
        </div>
        {errors.postContent && <p className="text-error">{errors.postContent.message}</p>}
        <input type="hidden" name="userId" value={userUuid} />
        <Turnstile siteKey={CF_TURNSTILE_SITEKEY} onSuccess={handleTurnstileSuccess} />
        <button
          type="submit"
          className="btn btn-primary disabled:btn-disabled"
          disabled={!isSubmitButtonOpen}
          onClick={handleSubmit}
        >
          変更を保存する
        </button>

        {errors.turnstileToken && <p className="text-error">{errors.turnstileToken.message}</p>}
      </form>
      <div className="mb-4">
        <H2>編集履歴</H2>
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th className="px-1 py-2">リビジョン</th>
              <th className="px-1 py-2">編集日時</th>
              <th className="px-1 py-2">編集者</th>
              <th className="px-1 py-2">タイトル差分</th>
              <th className="px-1 py-2">本文差分</th>
            </tr>
          </thead>
          <tbody>
            {editHistory?.map(
              (edit: {
                postRevisionNumber: number;
                postEditDateJst: Date;
                editorUserId: string;
                postTitleBeforeEdit: string;
                postTitleAfterEdit: string;
                postContentBeforeEdit: string;
                postContentAfterEdit: string;
              }) => (
                <tr key={edit.postRevisionNumber}>
                  <td className="border px-2 py-2">{edit.postRevisionNumber}</td>
                  <td className="border px-2 py-2">{edit.postEditDateJst.toLocaleString()}</td>
                  <td className="border px-2 py-2">{edit.editorUserId.slice(0, 8)}</td>
                  <td className="border px-2 py-2">
                    {diff
                      .diffChars(edit.postTitleBeforeEdit, edit.postTitleAfterEdit)
                      .map((part: diff.Change, index: number) => {
                        if (part.added || part.removed) {
                          const start = Math.max(0, part.value.indexOf(part.value) - 50);
                          const end = Math.min(
                            part.value.length,
                            part.value.indexOf(part.value) + 50,
                          );
                          const excerpt = part.value.slice(start, end);
                          return (
                            <span className={part.added ? 'bg-green-200' : 'bg-red-200'}>
                              {excerpt}
                            </span>
                          );
                        }
                        return null;
                      })}
                  </td>
                  <td className="border py-2">
                    {diff
                      .diffLines(edit.postContentBeforeEdit, edit.postContentAfterEdit)
                      .map((part: diff.Change, index: number) => {
                        if (part.added || part.removed) {
                          const start = Math.max(0, part.value.indexOf(part.value) - 50);
                          const end = Math.min(
                            part.value.length,
                            part.value.indexOf(part.value) + 50,
                          );
                          const excerpt = part.value.slice(start, end);
                          return (
                            <span className={part.added ? 'bg-green-200' : 'bg-red-200'}>
                              {excerpt}
                            </span>
                          );
                        }
                        return null;
                      })}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const action: ActionFunction = async (args) => {
  const formData = await args.request.formData();
  const editData = Object.fromEntries(formData);
  const ipAddress = await getHashedUserIPAddress(args.request);
  const isValidRequest = await validateRequest(editData.turnstileToken as string, ipAddress);
  if (!isValidRequest) {
    return {
      message: '認証に失敗しました。時間をおいて再度試してください。',
      success: false,
    };
  }

  const parsedData = {
    postTitle: editData.postTitle.toString(),
    postContent: editData.postContent.toString(),
    tags:
      typeof editData.tags === 'string' ? editData.tags.split(',').map((tag) => tag.trim()) : [],
    userId: editData.userId.toString(),
    turnstileToken: editData.turnstileToken.toString(),
  } as unknown as PostEditSchema;

  const parseResult = postEditSchema.safeParse(parsedData);
  if (!parseResult.success) {
    return { message: 'バリデーションエラーが発生しました。', success: false };
  }

  const postId = Number(args.params.postId);
  if (Number.isNaN(postId)) {
    return { message: '無効な投稿IDです', success: false };
  }

  /*
  - Markdedではマークダウン形式で書かれたテキストをHTMLに変換する役割を持っている
  - デフォルトのレンダラーでは、テーブルの一番上の行を<thead>タグで囲んでしまうため、HTMLで表示した際に5W1H+Then状況説明の「Who(誰が)」の行が見出しとして表示されてしまう
  - そこで、カスタムレンダラーを使用して、テーブルの一番上の行を<thead>タグで囲んでしまうのを防ぎ、<tbody>として扱うようにする
  */

  const renderer = new marked.Renderer();
  renderer.table = (token: Tokens.Table) => {
    const modifiedHeader = token.header.map((cell) => `<td>${cell.text}</td>`).join('');
    const body = token.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`)
      .join('');
    return `<table><tbody><tr>${modifiedHeader}</tr>${body}</tbody></table>`;
  };

  marked.use({ renderer });

  const postContentHtml = await marked(parsedData.postContent as string);

  let updatedPost;
  try {
    updatedPost = await updatePostWithTagsAndHistory({
      postId,
      postTitle: parsedData.postTitle,
      postContentHtml,
      tags: parsedData.tags,
      editorUserId: parsedData.userId,
    });
  } catch (error) {
    console.error(error);
    return { message: '投稿履歴が見つかりません', success: false };
  }

  await createEmbedding({
    postId: Number(updatedPost.postId),
    postContent: updatedPost.postContent,
    postTitle: updatedPost.postTitle,
  });
  return { success: true, message: '投稿を編集しました。' };
};

export const meta: MetaFunction = () => {
  return [{ title: '編集' }];
};
