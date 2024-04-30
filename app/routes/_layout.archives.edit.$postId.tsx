// _layout.archives.$postId.edit.tsx
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, json, redirect } from "@remix-run/node";
import { Form, NavLink, useLoaderData, useNavigation } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import { NodeHtmlMarkdown } from "node-html-markdown"
import { H1, H2 } from "~/components/Headings";
import { ClientOnly } from "remix-utils/client-only";
import MarkdownEditor from "~/components/MarkdownEditor.client";
import { useState } from "react";
// @ts-expect-error : markedの型定義が存在しないため、anyとしている
import { marked } from 'marked';
import { getSession, requireUserId } from "~/modules/session.server";
import * as diff from 'diff';
import { createEmbedding } from "~/modules/embedding.server";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";


export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const postId = params.postId;
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

  return json({
    postData,
    tagNames,
    postMarkdown,
    allTagsForSearch,
    userId,
    isEditing:false,
    postId,
    editHistory,
  });
}

export default function EditPost() {
  const { postData, postMarkdown, tagNames, allTagsForSearch, isEditing, postId, userId, editHistory } = useLoaderData<typeof loader>();
  const [markdownContent, setMarkdownContent] = useState<string>(postMarkdown || "");
  const [selectedTags, setSelectedTags] = useState<string[] | null>(tagNames);
  const navigation = useNavigation();

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

  const handleTagRemove = (tagName: string) => {
    if (selectedTags) {
      setSelectedTags(selectedTags.filter((tag) => tag !== tagName));
    }
  };

  const handleTagsSelected = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleMarkdownChange = (value: string | undefined) => {
    setMarkdownContent(value || "");
  };

  return (
    <ClientOnly fallback={<div>Loading...</div>}>
      {() => (
        <div className="max-w-2xl mx-auto">
          <H1>投稿を編集する</H1>
          <Form method="post">
            <H2>タイトルを編集する</H2>
            <p>変更前：{postData.postTitle}</p>
            <p className="my-4">変更後：</p>
            <div className="mb-4">
              <input
                type="text"
                id="postTitle"
                name="postTitle"
                defaultValue={postTitle}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 edit-post-title"
              />
            </div>
            <div className="mb-4">
              <H2>タグを編集する</H2>
              <div className="my-4">
                <div className="mt-2">
                  <p className="my-4">変更前：</p>
                  <div className="flex flex-wrap">
                    {oldTags.map((tag) => (
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
              <div className="mt-2">
                <p className="my-4">変更後：</p>
                <div className="flex flex-wrap">
                  {selectedTags && selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2 mb-2"
                    >
                      <input type="hidden" name="tags" value={tag} />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag)}
                        className="ml-2 edit-tag-remove-button"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-4">
              <H2>本文を編集する</H2>
              <MarkdownEditor
                defaultValue={markdownContent || ""}
                handleValueChange={handleMarkdownChange}
              />
            </div>
            <input type="hidden" name="postContent" value={markdownContent} />
            <button
              type="submit"
              className="rounded-md block w-full px-4 py-2 text-center text-white bg-primary edit-post-submit-button"
              disabled={navigation.state === "submitting"}
            >
              変更を保存する
            </button>
          </Form>
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
              {editHistory && editHistory.map((edit) => (
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
                           <span key={index} className={part.added ? 'bg-green-200' : 'bg-red-200'}>
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
                           <span key={index} className={part.added ? 'bg-green-200' : 'bg-red-200'}>
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
      )}
    </ClientOnly>
  );
}


export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const postTitle = formData.get("postTitle")?.toString() || "";
  const postContent = formData.get("postContent")?.toString() || "";
  const tags = formData.getAll("tags") as string[];
  const session = await getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');

  const postId = Number(params.postId);

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



  // 通常のレンダラーでは、Markdownテーブルの一行目が<thead>タグで囲まれてしまうため、カスタムレンダラーを使用する
  const renderer = new marked.Renderer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer.table = (header: string, body: any) => {
    const modifiedHeader = header.replace(/<thead>|<\/thead>/g, '').replace(/<th>/g, '<td>').replace(/<\/th>/g, '</td>');
    return `<table><tbody>${modifiedHeader}${body}</tbody></table>`;
  };
  marked.use({ renderer });

  const updatedPost = await prisma.$transaction(async (prisma) => {
    const updatedPost = await prisma.dimPosts.update({
      where: { postId },
      data: {
        postTitle,
        postContent: marked(postContent as string),
      }
    })
    
    await prisma.relPostTags.deleteMany({ where: { postId } });
  
    for (const tag of tags) {
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
        editorUserId: userId,
        postTitleBeforeEdit: latestPost.postTitle,
        postTitleAfterEdit: postTitle,
        postContentBeforeEdit: latestPost.postContent,
        postContentAfterEdit: marked(postContent as string),
      },
    });
  
    return updatedPost;
  },
  {
    timeout : 20000,
  });

  await createEmbedding({ postId: Number(updatedPost.postId), postContent: updatedPost.postContent });

  return redirect(`/archives/${updatedPost.postId}`);
}

export const meta : MetaFunction = () => {
  return [
    { title : "編集"}
  ]
}