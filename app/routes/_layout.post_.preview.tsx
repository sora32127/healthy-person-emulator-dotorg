import { useEffect, useState } from 'react';
import { useFetcher, useLoaderData, useNavigate } from 'react-router';
import { data } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { z } from 'zod';
import { H1 } from '~/components/Headings';
import { FaCopy } from 'react-icons/fa';
import { commonMetaFunction } from '~/utils/commonMetafunction';
import { createPostFormSchema } from '~/schemas/post.schema';
import {
  getHashedUserIPAddress,
  getJudgeWelcomedByGenerativeAI,
  getTurnStileSiteKey,
  validateRequest,
} from '~/modules/security.server';
import { commitSession, getSession, isUserValid } from '~/modules/session.server';
import { getStopWords, createPostWithTags, updatePostWelcomed } from '~/modules/db.server';
import { createEmbedding } from '~/modules/embedding.server';
import { Turnstile } from '@marsidev/react-turnstile';

interface PreviewData {
  wikifiedHtml: string;
  markdownResult: string;
  title: string;
  tags: string[];
  formValues: Record<string, unknown>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const turnStileSiteKey = await getTurnStileSiteKey();
  return { turnStileSiteKey };
}

export default function PreviewPage() {
  const { turnStileSiteKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isTurnstileVerified, setIsTurnstileVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('previewData');
    if (!stored) {
      navigate('/post');
      return;
    }
    setPreviewData(JSON.parse(stored));
  }, [navigate]);

  const turnstileFetcher = useFetcher();
  const handleTurnStileSuccess = (token: string) => {
    const formData = new FormData();
    formData.append('token', token);
    formData.append('_action', 'validateTurnstile');
    turnstileFetcher.submit(formData, { method: 'post', action: '/post/preview' });
  };

  useEffect(() => {
    const response = turnstileFetcher.data as { success: boolean } | undefined;
    if (response?.success === true) {
      setIsTurnstileVerified(true);
    }
    if (response?.success === false) {
      setSubmitError('リクエスト検証に失敗しました。時間をおいて再度お試しください。');
    }
  }, [turnstileFetcher.data]);

  const submitFetcher = useFetcher();
  const handleSubmit = () => {
    if (!previewData) return;
    const formData = new FormData();
    formData.append('_action', 'secondSubmit');
    for (const [key, value] of Object.entries(previewData.formValues)) {
      formData.append(key, JSON.stringify(value));
    }
    submitFetcher.submit(formData, { method: 'post', action: '/post/preview' });
  };

  useEffect(() => {
    if (submitFetcher.state === 'submitting') {
      setIsSubmitting(true);
    }
  }, [submitFetcher.state]);

  useEffect(() => {
    const response = submitFetcher.data as
      | {
          success: boolean;
          data?: { postId: number };
        }
      | undefined;
    if (response?.success === true && submitFetcher.state === 'idle') {
      sessionStorage.removeItem('previewData');
      window.localStorage.removeItem('post-form');
      window.localStorage.removeItem('selectedTags');
      window.localStorage.removeItem('createdTags');
      const postId = response.data?.postId;
      navigate(`/archives/${postId}`, { viewTransition: true });
    }
    if (response?.success === false) {
      setIsSubmitting(false);
      setSubmitError('投稿に失敗しました。時間をおいて再度お試しください。');
    }
  }, [submitFetcher.data, submitFetcher.state, navigate]);

  const handleCopy = async () => {
    if (!previewData) return;
    try {
      await navigator.clipboard.writeText(previewData.markdownResult);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // clipboard API may not be available
    }
  };

  if (!previewData) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-center mb-2">投稿内容のプレビュー</h2>
        <p className="text-center text-base-content/70">
          内容を確認し、問題なければ投稿してください。
        </p>
      </div>

      <div className="postContent previewContainer card bg-base-200 p-6 mb-6">
        <H1>{previewData.title}</H1>
        <div dangerouslySetInnerHTML={{ __html: previewData.wikifiedHtml }} />
      </div>

      {submitError && (
        <div className="alert alert-error mb-6">
          <p>{submitError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-base-200 pt-6">
        <button type="button" onClick={() => navigate('/post')} className="btn btn-secondary">
          修正する
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-circle btn-outline"
            title="Markdownをコピー"
          >
            <FaCopy />
          </button>
          {copySuccess && <span className="text-success text-sm">コピーしました</span>}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Turnstile siteKey={turnStileSiteKey} onSuccess={handleTurnStileSuccess} />
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={!isTurnstileVerified || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                投稿中...
              </>
            ) : (
              '投稿する'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('_action');

  if (actionType === 'validateTurnstile') {
    const turnstileToken = formData.get('token');
    const ipAddress = await getHashedUserIPAddress(request);
    const isValidatedByTurnstile = await validateRequest(turnstileToken as string, ipAddress);
    if (!isValidatedByTurnstile) {
      return data(
        {
          success: false,
          error: 'リクエストの検証に失敗しました。再度お試しください。',
        },
        { status: 400 },
      );
    }
    const session = await getSession(request.headers.get('Cookie'));
    session.set('isValidUser', true);
    return data({ success: true }, { headers: { 'Set-Cookie': await commitSession(session) } });
  }

  if (actionType === 'secondSubmit') {
    const isValid = await isUserValid(request);
    if (!isValid) {
      return data({ success: false, error: 'リクエスト検証に失敗しました。' }, { status: 400 });
    }

    const postData = Object.fromEntries(formData);
    const stopWords = await getStopWords();
    const postFormSchema = createPostFormSchema(stopWords);
    type Inputs = z.infer<typeof postFormSchema>;

    const parsedData = {
      ...postData,
      postCategory: JSON.parse(postData.postCategory as string),
      situations: JSON.parse(postData.situations as string),
      reflection: JSON.parse(postData.reflection as string),
      counterReflection: JSON.parse(postData.counterReflection as string),
      note: JSON.parse(postData.note as string),
      selectedTags: JSON.parse((postData.selectedTags as string) || '[]'),
      createdTags: JSON.parse((postData.createdTags as string) || '[]'),
      title: JSON.parse(postData.title as string),
    } as unknown as Inputs;

    const validationResult = postFormSchema.safeParse(parsedData);
    if (!validationResult.success) {
      return data({ success: false, error: 'バリデーションエラー' }, { status: 400 });
    }

    const wikifyResult = await Wikify(parsedData);
    if (!wikifyResult) {
      return data({ success: false, error: 'Wikify failed' }, { status: 400 });
    }

    const postTitle = parsedData.title[0];
    const hashedUserIpAddress = await getHashedUserIPAddress(request);

    const newPost = await createPostWithTags({
      postContent: wikifyResult,
      postTitle,
      hashedUserIpAddress,
      selectedTags: parsedData.selectedTags,
      createdTags: parsedData.createdTags,
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
      error: undefined,
      data: { postId: newPost.postId },
    });
  }
}

function Wikify(postData: z.infer<ReturnType<typeof createPostFormSchema>>): string {
  const { who, when, where, why, what, how, then, assumption } = postData.situations;
  const { reflection, counterReflection } = postData;
  const { note, postCategory } = postData;

  function removeEmptyString(array: string[] | undefined): string[] {
    if (!array) return [];
    return array.filter((value) => !/^\s*$/.test(value));
  }

  return `
    <h3>5W1H+Then状況説明</h3>
    <table><tbody>
      <tr><td>Who(誰が)</td><td>${who}</td></tr>
      <tr><td>When(いつ)</td><td>${when}</td></tr>
      <tr><td>Where(どこで)</td><td>${where}</td></tr>
      <tr><td>Why(なぜ)</td><td>${why}</td></tr>
      <tr><td>What(何を)</td><td>${what}</td></tr>
      <tr><td>How(どのように)</td><td>${how}</td></tr>
      <tr><td>Then(どうした)</td><td>${then}</td></tr>
    </tbody></table>
    ${
      removeEmptyString(assumption)?.length > 0
        ? `
      <h3>前提条件</h3>
      <ul>
        ${removeEmptyString(assumption)
          ?.map((a) => `<li>${a}</li>`)
          .join('\n')}
      </ul>
      `
        : ''
    }
    <h3>
      ${
        postCategory === 'misDeed'
          ? '健常行動ブレイクポイント'
          : postCategory === 'goodDeed'
            ? 'なぜやってよかったのか'
            : postCategory === 'wanted'
              ? '試したこと'
              : ''
      }
    </h3>
    <ul>
      ${removeEmptyString(reflection)
        ?.map((r) => `<li>${r}</li>`)
        .join('\n')}
    </ul>
    <h3>
      ${
        postCategory === 'misDeed'
          ? 'どうすればよかったか'
          : postCategory === 'goodDeed'
            ? 'やらなかったらどうなっていたか'
            : postCategory === 'wanted'
              ? 'まだやってないこと'
              : ''
      }
    </h3>
    <ul>
      ${removeEmptyString(counterReflection)
        ?.map((cr) => `<li>${cr}</li>`)
        .join('\n')}
    </ul>
    ${
      removeEmptyString(note)?.length > 0
        ? `
      <h3>備考</h3>
      <ul>
        ${removeEmptyString(note)
          ?.map((n) => `<li>${n}</li>`)
          .join('\n')}
      </ul>
    `
        : ''
    }
  `;
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: 'プレビュー',
    description: '投稿内容のプレビュー',
    url: 'https://healthy-person-emulator.org/post/preview',
    image: null,
  });
  return commonMeta;
};
