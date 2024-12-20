import { json, redirect } from "@remix-run/node";
import { Form, NavLink, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { NodeHtmlMarkdown } from "node-html-markdown"
import { useState } from "react";
import { getAuth } from "@clerk/remix/ssr.server";
import { marked } from 'marked';

import type { ActionFunction, LoaderFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import type { Tokens } from 'marked';

import { prisma } from "~/modules/db.server";
import { H1, H2 } from "~/components/Headings";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import * as diff from 'diff';
import { createEmbedding } from "~/modules/embedding.server";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { setVisitorCookieData } from "~/modules/visitor.server";
import { Turnstile } from "@marsidev/react-turnstile";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { getTurnStileSiteKey, validateRequest } from "~/modules/security.server";

const postEditSchema = z.object({
  postTitle: z.string().min(1, "タイトルが必要です"),
  postContent: z.string().min(10, "本文が短すぎます。"),
  tags: z.array(z.string()).min(1, "タグが必要です"),
  userId: z.string().min(1, "無効なリクエスト：ユーザーIDが必要です"),
  turnstileToken: z.string().min(1, "認証に失敗しました。時間をおいて再度試してください。"),
});

export type PostEditSchema = z.infer<typeof postEditSchema>;


async function requireUserId(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    const url = new URL(args.request.url)
    const pathName = url.pathname
    const headers = await setVisitorCookieData({
        redirectUrl: pathName
    });
    throw redirect('/login', { headers });
  }
  
  return userId;
}


export const loader:LoaderFunction = async(args) => {
  const userId = await requireUserId(args);
  const postId = args.params.postId;
  const nowEditingInfo = await prisma.nowEditingPages.findUnique({
    where : { postId: Number(postId) },
    select : {
      postId: true,
      userId: true,
      lastHeartBeatAtUTC: true
    },
  });

  /*
  記事が編集中かどうか判断するロジックは以下の通り
  - nowEditingInfoがnullの場合、編集中でない
  - nowEditingInfoが存在し、自分が編集中の場合、編集中でない
  - nowEditingInfoが存在し、最終ロック時刻から30分以上経過している場合、編集中でない
  - それ以外の場合は編集中と判断する。つまりは以下の場合：
    - nowEditingInfoが存在する
    - なおかつ、自分以外のユーザーIDが格納されている
    - なおかつ、lasteHeartBeatAtUTCから30分以内である
  */
  const isEditing = nowEditingInfo && nowEditingInfo.userId !== userId && (new Date().getTime() - new Date(nowEditingInfo.lastHeartBeatAtUTC).getTime()) < 30 * 60 * 1000;

  if (isEditing && nowEditingInfo){
    // モーダルを表示する：${nowEditingInfo.userId}さんが編集中です。
    // 「戻る」を押してredirect(`/archives/${postId}`)する
    return json({
      postData: null,
      postMarkdown: null,
      tagNames: null,
      allTagsForSearch: null,
      userId,
      postId,
      isEditing: true,
      editHistory: null,
    });
  }
    

  // 以下は編集中ではないことを前提とするロジック
  if (nowEditingInfo){
    await prisma.nowEditingPages.delete({
      where: { postId: Number(postId) },
    });
  }
  await prisma.nowEditingPages.create({
    data: {
      postId: Number(postId),
      userId: userId,
    },
  });

  const postData = await prisma.dimPosts.findUnique({
    where: {
      postId: Number(postId),
    },
    select: {
      postId: true,
      postTitle: true,
      postContent: true,
      rel_post_tags: {
        select: {
          dimTag: {
            select: {
              tagName: true,
            },
          },
        },
      },
    },
  });

  if (!postData) {
    throw new Response("Post not found", { status: 404 });
  }

  const tagNames = postData.rel_post_tags.map((rel) => rel.dimTag.tagName);
  
  
  const tags = await prisma.dimTags.findMany({
    select: {
      tagName: true,
      _count: {
        select: { relPostTags: true },
      },
    },
    orderBy: {
      relPostTags: {
        _count: "desc",
      },
    },
  });

  const allTagsForSearch = tags.map((tag) => {
    return { tagName: tag.tagName, count: tag._count.relPostTags };
  });

  const postMarkdown = NodeHtmlMarkdown.translate(postData.postContent);
  const editHistory = await prisma.fctPostEditHistory.findMany({
    select: {
      postRevisionNumber: true,
      postEditDateJst: true,
      editorUserId: true,
      postTitleBeforeEdit: true,
      postTitleAfterEdit: true,
      postContentBeforeEdit: true,
      postContentAfterEdit: true,
    },
    where : { postId: Number(postId) },
    orderBy : { postRevisionNumber: 'desc' },
  });
  const CF_TURNSTILE_SITEKEY = await getTurnStileSiteKey();

  return json({
    postData,
    tagNames,
    postMarkdown,
    allTagsForSearch,
    userId,
    CF_TURNSTILE_SITEKEY,
    isEditing:false,
    postId,
    editHistory,
  });
}

export default function EditPost() {
  const { postData, postMarkdown, tagNames, allTagsForSearch, isEditing, postId, userId, editHistory, CF_TURNSTILE_SITEKEY } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [selectedTags, setSelectedTags] = useState<string[]>(tagNames);
  const [isValidUser, setIsValidUser] = useState(false);

  const { setValue, getValues, register, handleSubmit, formState: { errors } } = useForm<PostEditSchema>({
    resolver: zodResolver(postEditSchema),
    defaultValues: {
      postTitle: postData.postTitle,
      postContent: postMarkdown,
      tags: tagNames,
      userId: userId,
    },
  });

  if (isEditing){
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <p className="text-xl font-bold mb-4">{userId}さんが編集中です。</p>
          <NavLink to={`/archives/${postId}`} className="block w-full text-center text-white bg-blue-500 hover:bg-blue-600 py-2 rounded-md">
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
  const oldTags = tagNames

  const handleTagsSelected = (tags: string[]) => {
    setValue('tags', tags);
    setSelectedTags(tags);
  };


  function handleTurnstileSuccess(token: string): void {
    setValue('turnstileToken', token);
    setIsValidUser(true);
  }

  const submit = useSubmit();
  const onSubmit: SubmitHandler<PostEditSchema> = (data) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value.toString());
    }
    submit(formData, {
      method: "post",
      action: `/archives/edit/${postId}`,
    });
  }

  return (
        <div className="max-w-2xl mx-auto">
          <H1>投稿を編集する</H1>
          <form method="post" onSubmit={handleSubmit(onSubmit)}>
            <H2>タイトルを編集する</H2>
            <p>変更前：{postData.postTitle}</p>
            <p className="my-4">変更後：</p>
            <div className="mb-4">
              <input
                type="text"
                id="postTitle"
                defaultValue={postTitle}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 edit-post-title"
                {...register("postTitle")}
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
                      <span key={tag} className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2 mb-2">
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
            <div className="mb-4">
              <H2>本文を編集する</H2>
              <MarkdownEditor
                value={getValues("postContent")}
                onChange={(value) => setValue("postContent", value)}
                register={register}
                name="postContent"
              />
            </div>
            {errors.postContent && <p className="text-error">{errors.postContent.message}</p>}
            <input type="hidden" name="userId" value={userId} />
            <Turnstile
              siteKey={CF_TURNSTILE_SITEKEY}
              onSuccess={handleTurnstileSuccess}
            />
            <button
              type="submit"
              className={`btn 
                ${!isValidUser ? "btn-disabled animate-pulse" : ""}
                ${isValidUser ? "btn-primary" : ""}
              `}
              disabled={navigation.state === "submitting" || !isValidUser}
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
              {editHistory?.map((edit: { postRevisionNumber: number; postEditDateJst: Date; editorUserId: string; postTitleBeforeEdit: string; postTitleAfterEdit: string; postContentBeforeEdit: string; postContentAfterEdit: string; }) => (
                 <tr key={edit.postRevisionNumber}>
                   <td className="border px-2 py-2">{edit.postRevisionNumber}</td>
                   <td className="border px-2 py-2">{edit.postEditDateJst.toLocaleString()}</td>
                   <td className="border px-2 py-2">{edit.editorUserId.slice(0,8)}</td>
                   <td className="border px-2 py-2">
                     {diff.diffChars(edit.postTitleBeforeEdit, edit.postTitleAfterEdit).map((part: diff.Change, index: number) => {
                       if (part.added || part.removed) {
                         const start = Math.max(0, part.value.indexOf(part.value) - 50);
                         const end = Math.min(part.value.length, part.value.indexOf(part.value) + 50);
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
                     {diff.diffLines(edit.postContentBeforeEdit, edit.postContentAfterEdit).map((part: diff.Change, index: number) => {
                       if (part.added || part.removed) {
                         const start = Math.max(0, part.value.indexOf(part.value) - 50);
                         const end = Math.min(part.value.length, part.value.indexOf(part.value) + 50);
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
               ))}
              </tbody>
            </table>
          </div>
        </div>
  )
}


export const action: ActionFunction = async (args) => {
  const formData = await args.request.formData();
  const editData = Object.fromEntries(formData);
  const url = new URL(args.request.url);
  const origin = url.origin;
  const isValidRequest = await validateRequest(editData.turnstileToken as string, origin);
  if (!isValidRequest){
    return json({ error: "認証に失敗しました。時間をおいて再度試してください。" }, { status: 400 });
  }


  const parsedData = {
    postTitle: editData.postTitle.toString(),
    postContent: editData.postContent.toString(),
    tags: typeof editData.tags === 'string' 
    ? editData.tags.split(',').map(tag => tag.trim())
    : [],
    userId: editData.userId.toString(),
    turnstileToken: editData.turnstileToken.toString(),
  } as unknown as PostEditSchema;

  const parseResult = postEditSchema.safeParse(parsedData);
  if (!parseResult.success){
    return json({ error: "バリデーションエラーが発生しました。" }, { status: 400 });
  }

  const postId = Number(args.params.postId);

  const latestPost = await prisma.dimPosts.findUnique({
    where: { postId },
  });

  if (!latestPost) {
    throw new Response("Post not found", { status: 404 });
  }

  let newRevisionNumber: number;

  try {
    const latestRevisionNumber = await prisma.fctPostEditHistory.findFirstOrThrow({
    select: { postRevisionNumber: true },
    where: { postId },
    orderBy: { postRevisionNumber: 'desc' },
    })
    newRevisionNumber = latestRevisionNumber.postRevisionNumber + 1;
  } catch (e) {
    newRevisionNumber = 1;
  }

  /*
  - Markdedではマークダウン形式で書かれたテキストをHTMLに変換する役割を持っている
  - デフォルトのレンダラーでは、テーブルの一番上の行を<thead>タグで囲んでしまうため、HTMLで表示した際に5W1H+Then状況説明の「Who(誰が)」の行が見出しとして表示されてしまう
  - そこで、カスタムレンダラーを使用して、テーブルの一番上の行を<thead>タグで囲んでしまうのを防ぎ、<tbody>として扱うようにする
  */
  
  const renderer = new marked.Renderer();
  renderer.table = (token: Tokens.Table) => {
    const modifiedHeader = token.header.map((cell) => `<td>${cell.text}</td>`).join('');
    const body = token.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`).join('');
    return `<table><tbody><tr>${modifiedHeader}</tr>${body}</tbody></table>`;
  };

  marked.use({ renderer });

  const updatedPost = await prisma.$transaction(async (prisma) => {
    const updatedPost = await prisma.dimPosts.update({
      where: { postId },
      data: {
        postTitle: parsedData.postTitle,
        postContent: await marked(parsedData.postContent as string),
      }
    })
    
    await prisma.relPostTags.deleteMany({ where: { postId } });
  
    for (const tag of parsedData.tags) {
      const existingTag = await prisma.dimTags.findFirst({
        where: { tagName: tag },
        orderBy: { tagId: 'desc' },
      });

      await prisma.relPostTags.create({
        data: {
          postId,
          tagId: existingTag?.tagId || 0
        }
        },
      );
    }

    await prisma.fctPostEditHistory.create({
      data: {
        postId,
        postRevisionNumber: newRevisionNumber,
        editorUserId: parsedData.userId,
        postTitleBeforeEdit: latestPost.postTitle,
        postTitleAfterEdit: parsedData.postTitle,
        postContentBeforeEdit: latestPost.postContent,
        postContentAfterEdit: await marked(parsedData.postContent as string),
      },
    });
  
    return updatedPost;
  },
  {
    timeout : 20000,
  });

  await createEmbedding({ postId: Number(updatedPost.postId), postContent: updatedPost.postContent, postTitle: updatedPost.postTitle});

  return redirect(`/archives/${updatedPost.postId}`);
}

export const meta : MetaFunction = () => {
  return [
    { title : "編集"}
  ]
}