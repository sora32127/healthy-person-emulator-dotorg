import { useEffect, useState } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import { data, redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { z } from 'zod';
import { Copy, Check } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { H1, H2 } from '~/components/Headings';
import { CommonNavLink } from '~/components/CommonNavLink';
import { wikify } from '~/utils/wikify.server';
import { createPostFormSchema } from '~/schemas/post.schema';
import {
  getStopWords,
  createPostWithTags,
  updatePostWelcomed,
  getSimilarPostsByText,
} from '~/modules/db.server';
import { createEmbedding } from '~/modules/embedding.server';
import {
  getHashedUserIPAddress,
  getJudgeWelcomedByGenerativeAI,
} from '~/modules/security.server';
import { isUserValid } from '~/modules/session.server';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export async function loader({ request }: LoaderFunctionArgs) {
  const isValid = await isUserValid(request);
  if (!isValid) {
    return redirect('/post');
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('_action');

  const isValid = await isUserValid(request);
  if (!isValid) {
    return data(
      { success: false, error: 'セッションが無効です。再度認証してください。' },
      { status: 400 },
    );
  }

  if (actionType === 'getPreview') {
    const stopWords = await getStopWords();
    const postFormSchema = createPostFormSchema(stopWords);
    type Inputs = z.infer<typeof postFormSchema>;

    const postData = Object.fromEntries(formData);
    const parsedData = {
      ...postData,
      postCategory: JSON.parse(postData.postCategory as string),
      situations: JSON.parse(postData.situations as string),
      reflection: JSON.parse(postData.reflection as string),
      counterReflection: JSON.parse(postData.counterReflection as string),
      note: JSON.parse((postData.note as string) || '[]'),
      selectedTags: JSON.parse((postData.selectedTags as string) || '[]'),
      createdTags: JSON.parse((postData.createdTags as string) || '[]'),
      title: JSON.parse(postData.title as string),
    } as unknown as Inputs;

    const result = wikify(parsedData, postFormSchema);
    if (!result.success) {
      return data({ success: false, error: 'プレビューの生成に失敗しました' }, { status: 400 });
    }

    return data({
      success: true,
      data: {
        ...result.data,
        title: parsedData.title[0],
        tags: [...(parsedData.createdTags || []), ...(parsedData.selectedTags || [])],
      },
    });
  }

  if (actionType === 'getSimilarPosts') {
    const text = formData.get('text') as string;
    if (!text) {
      return data({ success: true, similarPosts: [] });
    }
    const similarPosts = await getSimilarPostsByText(text);
    return data({ success: true, similarPosts });
  }

  if (actionType === 'submitPost') {
    const stopWords = await getStopWords();
    const postFormSchema = createPostFormSchema(stopWords);
    type Inputs = z.infer<typeof postFormSchema>;

    const postData = Object.fromEntries(formData);
    const parsedData = {
      ...postData,
      postCategory: JSON.parse(postData.postCategory as string),
      situations: JSON.parse(postData.situations as string),
      reflection: JSON.parse(postData.reflection as string),
      counterReflection: JSON.parse(postData.counterReflection as string),
      note: JSON.parse((postData.note as string) || '[]'),
      selectedTags: JSON.parse((postData.selectedTags as string) || '[]'),
      createdTags: JSON.parse((postData.createdTags as string) || '[]'),
      title: JSON.parse(postData.title as string),
    } as unknown as Inputs;

    const result = wikify(parsedData, postFormSchema);
    if (!result.success || !result.data) {
      return data({ success: false, error: 'Wikify failed' }, { status: 400 });
    }

    const wikifyResult = result.data.WikifiedResult;
    const postTitle = parsedData.title[0];
    const { createdTags, selectedTags } = parsedData;

    const hashedUserIpAddress = await getHashedUserIPAddress(request);
    const newPost = await createPostWithTags({
      postContent: wikifyResult,
      postTitle,
      hashedUserIpAddress,
      selectedTags: selectedTags || [],
      createdTags: createdTags || [],
    });

    await createEmbedding({
      postId: Number(newPost.postId),
      postContent: newPost.postContent,
      postTitle: newPost.postTitle,
    });

    const { isWelcomed, explanation } = await getJudgeWelcomedByGenerativeAI(
      wikifyResult,
      postTitle,
    );
    await updatePostWelcomed(Number(newPost.postId), isWelcomed, explanation);

    return data({
      success: true,
      data: { postId: newPost.postId },
    });
  }

  return data({ success: false, error: 'Unknown action' }, { status: 400 });
}

interface FormDataFromStorage {
  title: string[];
  postCategory: string;
  situations: Record<string, string>;
  reflection: string[];
  counterReflection: string[];
  note: string[];
  selectedTags: string[];
  createdTags: string[];
}

function StepIndicator() {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm font-bold">
          1
        </div>
        <span className="text-sm text-base-content/60">入力</span>
      </div>
      <div className="w-8 h-px bg-base-300" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold">
          2
        </div>
        <span className="text-sm font-bold text-base-content">確認</span>
      </div>
      <div className="w-8 h-px bg-base-300" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm text-base-content/40">
          3
        </div>
        <span className="text-sm text-base-content/40">完了</span>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 bg-base-300 rounded w-3/4 mx-auto" />
      <div className="flex gap-2 justify-center">
        <div className="h-6 bg-base-300 rounded-full w-16" />
        <div className="h-6 bg-base-300 rounded-full w-20" />
        <div className="h-6 bg-base-300 rounded-full w-14" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-base-300 rounded w-full" />
        <div className="h-4 bg-base-300 rounded w-5/6" />
        <div className="h-4 bg-base-300 rounded w-4/5" />
        <div className="h-4 bg-base-300 rounded w-full" />
        <div className="h-4 bg-base-300 rounded w-2/3" />
      </div>
    </div>
  );
}

function SimilarPostsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true">
      <div className="h-6 bg-base-300 rounded w-32" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-4 bg-base-300 rounded w-4/5 ml-4" />
      ))}
    </div>
  );
}

export default function ConfirmPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormDataFromStorage | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const previewFetcher = useFetcher();
  const similarPostsFetcher = useFetcher();
  const submitFetcher = useFetcher();

  // Step 1: Load form data from localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem('post-form');
    if (!stored) {
      toast.error('フォームデータが見つかりません');
      navigate('/post');
      return;
    }
    try {
      const parsed = JSON.parse(stored) as FormDataFromStorage;
      setFormData(parsed);
    } catch {
      toast.error('フォームデータの読み込みに失敗しました');
      navigate('/post');
    }
  }, [navigate]);

  // Step 2: Fetch preview when formData is loaded
  useEffect(() => {
    if (!formData || previewFetcher.state !== 'idle' || previewFetcher.data) return;

    const fd = new FormData();
    fd.append('_action', 'getPreview');
    for (const [key, value] of Object.entries(formData)) {
      fd.append(key, JSON.stringify(value));
    }
    previewFetcher.submit(fd, { method: 'post', action: '/post/confirm' });
  }, [formData]);

  // Step 3: Fetch similar posts after preview is done
  const previewData = previewFetcher.data as
    | { success: true; data: { WikifiedResult: string; MarkdownResult: string; title: string; tags: string[] } }
    | { success: false; error: string }
    | undefined;

  useEffect(() => {
    if (!previewData?.success || !formData || similarPostsFetcher.state !== 'idle' || similarPostsFetcher.data) return;

    const previewSuccessData = previewData as { success: true; data: { WikifiedResult: string; title: string; tags: string[] } };
    const tags = [...(formData.selectedTags || []), ...(formData.createdTags || [])];
    const inputText = `タイトル: ${previewSuccessData.data.title}\nタグ: ${tags.join(',')}\n本文: ${previewSuccessData.data.WikifiedResult}`;

    const fd = new FormData();
    fd.append('_action', 'getSimilarPosts');
    fd.append('text', inputText);
    similarPostsFetcher.submit(fd, { method: 'post', action: '/post/confirm' });
  }, [previewData, formData]);

  // Step 4: Handle submit result
  const submitData = submitFetcher.data as
    | { success: true; data: { postId: number } }
    | { success: false; error: string }
    | undefined;

  useEffect(() => {
    if (submitFetcher.state === 'submitting') {
      toast.loading('投稿中です...', { id: 'submit-loading' });
    }
  }, [submitFetcher.state]);

  useEffect(() => {
    if (!submitData) return;

    toast.dismiss('submit-loading');

    if (submitData.success) {
      window.localStorage.removeItem('post-form');
      window.localStorage.removeItem('selectedTags');
      window.localStorage.removeItem('createdTags');
      toast.success('投稿しました。リダイレクトします...', { id: 'post-success' });
      setTimeout(() => {
        navigate(`/archives/${submitData.data.postId}`, { viewTransition: true });
      }, 2000);
    } else {
      toast.error(submitData.error || '投稿に失敗しました');
    }
  }, [submitData, navigate]);

  const handleSubmit = () => {
    if (!formData) return;
    const fd = new FormData();
    fd.append('_action', 'submitPost');
    for (const [key, value] of Object.entries(formData)) {
      fd.append(key, JSON.stringify(value));
    }
    submitFetcher.submit(fd, { method: 'post', action: '/post/confirm' });
  };

  const handleCopy = async () => {
    if (!previewData?.success) return;
    const successData = previewData as { success: true; data: { MarkdownResult: string } };
    try {
      await navigator.clipboard.writeText(successData.data.MarkdownResult);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch {
      toast.error('クリップボードにコピーできませんでした');
    }
  };

  const isPreviewLoading = previewFetcher.state !== 'idle';
  const isPreviewError = previewData && !previewData.success;
  const isPreviewReady = previewData?.success === true;
  const isSimilarLoading = similarPostsFetcher.state !== 'idle';
  const isSubmitting = submitFetcher.state !== 'idle';

  const similarData = similarPostsFetcher.data as
    | { success: true; similarPosts: { postId: number; postTitle: string }[] }
    | undefined;

  return (
    <div className="templateSubmitForm">
      <Toaster />
      <StepIndicator />

      {/* Preview section */}
      <div className="mb-8">
        {isPreviewLoading ? (
          <PreviewSkeleton />
        ) : isPreviewError ? (
          <div className="text-center py-8">
            <p className="text-error mb-4">プレビューの取得に失敗しました</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!formData) return;
                const fd = new FormData();
                fd.append('_action', 'getPreview');
                for (const [key, value] of Object.entries(formData)) {
                  fd.append(key, JSON.stringify(value));
                }
                previewFetcher.submit(fd, { method: 'post', action: '/post/confirm' });
              }}
            >
              再試行
            </button>
          </div>
        ) : isPreviewReady ? (
          <div className="postContent previewContainer">
            <H1>
              {(previewData as { success: true; data: { title: string } }).data.title}
            </H1>
            <div
              dangerouslySetInnerHTML={{
                __html: (previewData as { success: true; data: { WikifiedResult: string } }).data
                  .WikifiedResult,
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Similar posts section */}
      <div className="mb-8">
        {isSimilarLoading ? (
          <SimilarPostsSkeleton />
        ) : similarData?.success && similarData.similarPosts.length > 0 ? (
          <>
            <H2>類似した記事</H2>
            <div className="w-full px-1">
              <ul className="list-disc list-outside mb-4 ml-4">
                {similarData.similarPosts.map((post) => (
                  <li key={post.postId} className="my-2">
                    <CommonNavLink to={`/archives/${post.postId}`}>
                      {post.postTitle}
                    </CommonNavLink>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-4 -mx-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/post')}
          >
            修正する
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={handleCopy}
              disabled={!isPreviewReady}
              aria-label="プレビューをクリップボードにコピー"
            >
              {isCopied ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting || !isPreviewReady}
              onClick={handleSubmit}
            >
              {isSubmitting ? '投稿中...' : '投稿する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const meta: MetaFunction = () => {
  return commonMetaFunction({
    title: '投稿確認',
    description: '投稿内容を確認します',
    url: 'https://healthy-person-emulator.org/post/confirm',
    image: null,
  });
};
