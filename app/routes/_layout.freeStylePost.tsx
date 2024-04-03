import { Turnstile } from "@marsidev/react-turnstile";
import { Form, redirect, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { H1, H2 } from "~/components/Headings";
import MarkdownEditor from "~/components/MarkdownEditor.client";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { prisma } from "~/modules/db.server";
import { marked } from 'marked';
import { ActionFunctionArgs } from "@remix-run/node";

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

    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleClearInputs = () => {
        setShowConfirmation(true);
    };

    const handleConfirmClear = () => {
        setTitle('');
        setMarkdownContent('');
        setSelectedTags([]);
        window.localStorage.removeItem('titleFS');
        window.localStorage.removeItem('markdownContentFS');
        window.localStorage.removeItem('selectedTags');
        setShowConfirmation(false);
    };

    const handleCancelClear = () => {
        setShowConfirmation(false);
    };

    const isButtonDisabled = !title || !markdownContent || !isValidUser;


    return (
        <ClientOnly fallback={<div>Loading...</div>}>
            {() => (
                <div>
                    <H1>自由記述投稿</H1>
                    <p>テンプレートを利用しない、自由形式の記事投稿が可能です。</p>
                    <Form method="post">
                    <button
                            type="button"
                            onClick={handleClearInputs}
                            className="inline-flex items-center px-4 py-2 my-4 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            入力内容をクリア
                    </button>
                    <H2>記事タイトル</H2>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="記事タイトルを入力..."
                        className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none mb-4"
                    />
                    {!title && <p className="text-red-500">タイトルを入力してください。</p>}
                    <H2>記事本文</H2>
                    <MarkdownEditor
                        defaultValue={markdownContent}
                        handleValueChange={handleMarkdownChange}/>
                    {!markdownContent && <p className="text-red-500">本文を入力してください。</p>}
                    <TagSelectionBox
                        onTagsSelected={handleTagSelection}
                        parentComponentStateValues={selectedTags}
                        allTagsOnlyForSearch={allTagsForSearch}
                    />
                    <Turnstile siteKey={CFTurnstileSiteKey} onSuccess={() => handleTurnstileValidation(true)}/>
                    <button
                        type="submit"
                        className={`rounded-md block w-full px-4 py-2 text-center text-white my-4 ${
                        isButtonDisabled
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                        disabled={isButtonDisabled}
                    >
                    投稿する
                    </button>
                    <input type="hidden" name="title" value={title} />
                    <input type="hidden" name="markdownContent" value={markdownContent} />
                    <input type="hidden" name="selectedTags" value={selectedTags.join(',')} />
                    </Form>
                    {showConfirmation && (
                        <div className="fixed z-10 inset-0 overflow-y-auto">
                            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                                <div className="fixed inset-0 transition-opacity">
                                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                                </div>
                                <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>&#8203;
                                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start">
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    入力内容のクリア
                                                </h3>
                                                <div className="mt-2">
                                                    <p className="text-sm text-gray-500">
                                                        本当に入力内容をクリアしますか？この操作は元に戻せません。
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                        <button
                                            type="button"
                                            onClick={handleConfirmClear}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            はい
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelClear}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            戻る
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </ClientOnly>
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
                postDateJst: new Date(),
                postDateGmt: new Date(),
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

    return redirect(`/archives/${newPost.postId}`);
}

