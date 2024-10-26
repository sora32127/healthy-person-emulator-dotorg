import { Turnstile } from "@marsidev/react-turnstile";
import { Form, redirect, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { H1, H2 } from "~/components/Headings";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { prisma } from "~/modules/db.server";
import { marked } from 'marked';
import { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { createEmbedding } from "~/modules/embedding.server";
import ClearLocalStorageButton from "~/components/SubmitFormComponents/ClearLocalStorageButton";
import { commonMetaFunction } from "~/utils/commonMetafunction";

interface Tag {
    tagName: string;
    count: number;
}

export async function loader() {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTagsForSearch: Tag[] = tags.map((tag:any) => {
    return { tagName: tag.tagName, count: tag._count.relPostTags };
    });

    const CFTurnstileSiteKey = process.env.CF_TURNSTILE_SITEKEY;

    return { allTagsForSearch, CFTurnstileSiteKey };
}

export default function FreeStylePost() {

    const { allTagsForSearch, CFTurnstileSiteKey } = useLoaderData<typeof loader>();

    const [title, setTitle] = useState<string>('');
    const [markdownContent, setMarkdownContent] = useState<string>('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    const [isValidUser, setIsValidUser] = useState(false);


    useEffect(() => {
        const savedTitle = window.localStorage.getItem('titleFS');
        const initialTitleValue = JSON.parse(savedTitle || '""');
        setTitle(initialTitleValue);
        const savedMarkdownContent = window.localStorage.getItem('markdownContentFS');
        const initialMarkdownContentValue = JSON.parse(savedMarkdownContent || '""');
        setMarkdownContent(initialMarkdownContentValue);
        const savedTags = window.localStorage.getItem('selectedTags');
        const initialTagsValue = JSON.parse(savedTags || '[]');
        setSelectedTags(initialTagsValue);
    }, []);

    const handleTitleChange = (title: string) => {
        setTitle(title);
        window.localStorage.setItem('titleFS', JSON.stringify(title));
    }

    const handleMarkdownChange = (content: string) => {
        setMarkdownContent(content);
        window.localStorage.setItem('markdownContentFS', JSON.stringify(content));
    }

    const handleTagSelection = (tags: string[]) => {
        setSelectedTags(tags);
        window.localStorage.setItem('selectedTags', JSON.stringify(tags));
    }

    const handleTurnstileValidation = (isValidUser: boolean) => {
        setIsValidUser(isValidUser);
    };

    const handleConfirmClear = () => {
        setTitle('');
        setMarkdownContent('');
        setSelectedTags([]);
        window.localStorage.removeItem('titleFS');
        window.localStorage.removeItem('markdownContentFS');
        window.localStorage.removeItem('selectedTags');
    };


    const isButtonDisabled = !title || !markdownContent || !isValidUser;

    if (!CFTurnstileSiteKey) {
        return <div>Turnstileのサイトキーが設定されていません。</div>;
    }


    return (
        <div>
            <H1>自由記述投稿</H1>
            <p>テンプレートを利用しない、自由形式の記事投稿が可能です。</p>
            <Form method="post">
            <ClearLocalStorageButton clearInputs={handleConfirmClear} />
            <H2>記事タイトル</H2>
            <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="記事タイトルを入力..."
                className="w-full px-3 py-2 placeholder-slate-500 border rounded-lg focus:outline-none mb-4"
            />
            {!title && <p className="text-error">タイトルを入力してください。</p>}
            <H2>記事本文</H2>
            <MarkdownEditor value={markdownContent} onChange={handleMarkdownChange} />
            {!markdownContent && <p className="text-error">本文を入力してください。</p>}
            <TagSelectionBox
                onTagsSelected={handleTagSelection}
                parentComponentStateValues={selectedTags}
                allTagsOnlyForSearch={allTagsForSearch}
            />
            <Turnstile siteKey={CFTurnstileSiteKey} onSuccess={() => handleTurnstileValidation(true)}/>
            <button
                type="submit"
                className={`rounded-md block w-full px-4 py-2 text-center my-4 ${
                isButtonDisabled
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'btn-primary'
                }`}
                disabled={isButtonDisabled}
            >
            投稿する
            </button>
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="markdownContent" value={markdownContent} />
            <input type="hidden" name="selectedTags" value={selectedTags.join(',')} />
            </Form>
    </div>
    )
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const markdownContent = formData.get('markdownContent') as string;
    const selectedTags = (formData.get('selectedTags') as string).split(',');

    const ip = getClientIPAddress(request) || "";
    const postUserIpHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip)
    );
    const hashArray = Array.from(new Uint8Array(postUserIpHash));
    const postUserIpHashString = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 通常のレンダラーでは、Markdownテーブルの一行目が<thead>タグで囲まれてしまうため、カスタムレンダラーを使用する
    const renderer = new marked.Renderer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderer.table = (header: string, body: any) => {
        const modifiedHeader = header.replace(/<thead>|<\/thead>/g, '').replace(/<th>/g, '<td>').replace(/<\/th>/g, '</td>');
        return `<table><tbody>${modifiedHeader}${body}</tbody></table>`;
    };
    marked.use({ renderer });

    const newPost = await prisma.$transaction(async (prisma) => {
        const newPost = await prisma.dimPosts.create({
            data: {
                postTitle: title,
                postContent: marked(markdownContent as string),
                postAuthorIPHash: postUserIpHashString,
                countLikes: 0,
                countDislikes: 0,
                commentStatus: 'open',
            },
        });
        for (const tag of selectedTags) {
            let existingTag 
            existingTag = await prisma.dimTags.findFirst({
                where: { tagName: tag },
            });
            if (!existingTag) {
                existingTag = await prisma.dimTags.create({
                    data: {
                        tagName: tag,   
                    },
                });
            }
            await prisma.relPostTags.create({
                data: {
                    postId: newPost.postId,
                    tagId: existingTag.tagId
                },
            }); 
        }
        return newPost;
    });

    await createEmbedding({ postId: Number(newPost.postId), postContent: newPost.postContent, postTitle: newPost.postTitle });

    return redirect(`/archives/${newPost.postId}`);
}

export const meta:MetaFunction = () => {
    const commonMeta = commonMetaFunction({
        title : "自由記述投稿",
        description : "フリースタイルで記事を投稿しよう",
        url: "https://healthy-person-emulator.org/freeStylePost",
        image: null
    });

    return commonMeta;
}