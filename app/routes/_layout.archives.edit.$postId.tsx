// _layout.archives.$postId.edit.tsx
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import { NodeHtmlMarkdown } from "node-html-markdown"
import { H1, H2 } from "~/components/Headings";
import { ClientOnly } from "remix-utils/client-only";
import MarkdownEditor from "~/components/MarkdownEditor.client";
import { useState } from "react";
import { marked } from 'marked';
import { requireUserId } from "~/modules/session.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  console.log(userId)
  const postId = params.postId;

  const postData = await prisma.userPostContent.findFirst({
    where: {
      postId: Number(postId),
    },
    orderBy: {
      postRevisionNumber: "desc",
    },
  });

  if (!postData) {
    throw new Response("Post not found", { status: 404 });
  }

  const tagNames = await prisma.dimTags.findMany({
    select: {
      tagName: true,
    },
    where: {
      postId: Number(postId),
    },
  });

  const allTags = await prisma.dimTags.groupBy({
    by: ["tagName"],
    _count: { postId: true },
    orderBy: { _count: { postId: "desc" } },
  });

  const allTagsForSearch = allTags.map((tag: { tagName: string, _count: { postId: number } }) => {
    return { tagName: tag.tagName, count: tag._count.postId };
  });

  const postMarkdown = NodeHtmlMarkdown.translate(postData.postContent);

  return json({ postData, tagNames, postMarkdown, allTagsForSearch });
}

export default function EditPost() {
  const { postData, postMarkdown, tagNames, allTagsForSearch } = useLoaderData<typeof loader>();
  const { postTitle } = postData;

  const [markdownContent, setMarkdownContent] = useState(postMarkdown);
  const [selectedTags, setSelectedTags] = useState<string[]>(tagNames.map(tag => tag.tagName));
  const [tagInputValue, setTagInputValue] = useState<string>("");
  const [tagSearchSuggestions, setTagSearchSuggestions] = useState<{ tagName: string, count: number }[]>([]);
  const oldTags = tagNames.map(tag => tag.tagName)

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInputValue(value);

    if (value.length > 0) {
      const filteredTagSearchSuggestions = allTagsForSearch.filter((tag) => tag.tagName.includes(value));
      setTagSearchSuggestions(filteredTagSearchSuggestions);
    } else {
      setTagSearchSuggestions([]);
    }
  };

  const handleTagSelect = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
      setTagInputValue("");
      setTagSearchSuggestions([]);
    }
  };

  const handleTagRemove = (tagName: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagName));
  };

  const navigation = useNavigation();

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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <H2>タグを編集する</H2>
              <div className="my-4">
                <p className="my-4">変更前：</p>
                {oldTags.flatMap(
                  (tag) =>
                  <span className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2">{tag}</span>
                )}
              </div>
              <div className="flex items-center">
                <input
                  type="text"
                  value={tagInputValue}
                  onChange={handleTagInputChange}
                  className="border border-gray-300 rounded-l px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="タグを検索"
                />
              </div>
              {tagSearchSuggestions.length > 0 && (
                <ul className="mt-2 border border-gray-300 rounded">
                  {tagSearchSuggestions.map((tag) => (
                    <li
                      key={tag.tagName}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleTagSelect(tag.tagName)}
                    >
                      {tag.tagName} ({tag.count})
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2">
                <p className="my-4">変更後：</p>
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2"
                  >
                    <input type="hidden" name="tags" value={tag} />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="ml-2"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <H2>本文を編集する</H2>
              <MarkdownEditor
                defaultValue={markdownContent}
                handleValueChange={setMarkdownContent}
              />
            </div>
            <input type="hidden" name="postContent" value={markdownContent} />
            <button
              type="submit"
              className="rounded-md block w-full px-4 py-2 text-center text-white bg-blue-500 hover:bg-blue-600"
              disabled={navigation.state === "submitting"}
            >
              変更を保存する
            </button>
          </Form>
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

  const postId = Number(params.postId);

  const latestPost = await prisma.userPostContent.findFirst({
    where: { postId },
    orderBy: { postRevisionNumber: "desc" },
  });

  if (!latestPost) {
    throw new Response("Post not found", { status: 404 });
  }

  const newRevisionNumber = latestPost.postRevisionNumber + 1;

  // 通常のレンダラーでは、Markdownテーブルの一行目が<thead>タグで囲まれてしまうため、カスタムレンダラーを使用する
  const renderer = new marked.Renderer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer.table = (header: string, body: any) => {
    const modifiedHeader = header.replace(/<thead>|<\/thead>/g, '').replace(/<th>/g, '<td>').replace(/<\/th>/g, '</td>');
    return `<table><tbody>${modifiedHeader}${body}</tbody></table>`;
  };
  marked.use({ renderer });

  const updatedPost = await prisma.$transaction(async (prisma) => {
    const updatedPost = await prisma.userPostContent.create({
      data: {
        postId,
        postRevisionNumber: newRevisionNumber,
        postAuthorHash: latestPost.postAuthorHash,
        postDateJst: new Date(),
        postDateGmt: new Date(),
        postContent: marked(postContent),
        postTitle: postTitle,
        postStatus: latestPost.postStatus,
        commentStatus: latestPost.commentStatus,
        postUrl: latestPost.postUrl,
        countLikes: latestPost.countLikes,
        countDislikes: latestPost.countDislikes,
      },
    });
  
    await prisma.dimTags.deleteMany({ where: { postId } });
  
    for (const tag of tags) {
      const existingTag = await prisma.dimTags.findFirst({
        where: { tagName: tag },
        orderBy: { tagId: 'desc' },
      });

      const maxTagId = await prisma.dimTags.aggregate({ _max: { tagId: true } });
      const tagId = existingTag ? existingTag.tagId : (maxTagId?._max?.tagId || 0) + 1 || 1;

      await prisma.dimTags.create({
        data: {
          tagId,
          postId,
          tagName: tag,
        },
      });
    }
  
    return updatedPost;
  });

  return redirect(`/archives/${updatedPost.postId}`);
}
