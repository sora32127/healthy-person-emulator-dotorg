import { useFetcher, Link } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { requireAdmin } from '~/modules/admin.server';
import { mergePosts, generateMergeDraft } from '~/modules/admin-merge.server';
import type { CloudflareEnv } from '~/types/env';
import { drizzle } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import { dimPosts } from '~/drizzle/schema';

type SourcePost = {
  postId: number;
  postTitle: string;
  postContent: string;
};

type LoadSourcesResult = {
  action: 'loadSources';
  success: boolean;
  sourcePosts?: SourcePost[];
  error?: string;
};

type GenerateDraftResult = {
  action: 'generateDraft';
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
};

type ExecuteMergeResult = {
  action: 'executeMerge';
  success: boolean;
  mergedPostId?: number;
  error?: string;
};

type ActionResult = LoadSourcesResult | GenerateDraftResult | ExecuteMergeResult;

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAdmin(request);
  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;

  if (actionType === 'loadSources') {
    const idsRaw = (formData.get('sourcePostIds') as string) || '';
    const postIds = idsRaw
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0);

    if (postIds.length < 2) {
      return { action: 'loadSources', success: false, error: '2つ以上の記事IDを入力してください' };
    }

    const db = drizzle(env.DB);
    const posts = await db
      .select({
        postId: dimPosts.postId,
        postTitle: dimPosts.postTitle,
        postContent: dimPosts.postContent,
      })
      .from(dimPosts)
      .where(inArray(dimPosts.postId, postIds));

    if (posts.length !== postIds.length) {
      const foundIds = posts.map((p) => p.postId);
      const missingIds = postIds.filter((id) => !foundIds.includes(id));
      return {
        action: 'loadSources',
        success: false,
        error: `記事が見つかりません: ${missingIds.join(', ')}`,
      };
    }

    return { action: 'loadSources', success: true, sourcePosts: posts };
  }

  if (actionType === 'generateDraft') {
    const sourcePostsJson = formData.get('sourcePosts') as string;
    const sourcePosts: SourcePost[] = JSON.parse(sourcePostsJson);

    try {
      const draft = await generateMergeDraft(env, sourcePosts);
      return { action: 'generateDraft', success: true, ...draft };
    } catch (err) {
      return {
        action: 'generateDraft',
        success: false,
        error: err instanceof Error ? err.message : 'AI生成に失敗しました',
      };
    }
  }

  if (actionType === 'executeMerge') {
    const sourcePostIdsJson = formData.get('sourcePostIds') as string;
    const sourcePostIds: number[] = JSON.parse(sourcePostIdsJson);
    const newPostTitle = formData.get('newPostTitle') as string;
    const newPostContent = formData.get('newPostContent') as string;

    if (!newPostTitle?.trim() || !newPostContent?.trim()) {
      return { action: 'executeMerge', success: false, error: 'タイトルと本文を入力してください' };
    }

    try {
      const result = await mergePosts(env, sourcePostIds, newPostTitle, newPostContent);
      return { action: 'executeMerge', success: true, mergedPostId: result.mergedPostId };
    } catch (err) {
      return {
        action: 'executeMerge',
        success: false,
        error: err instanceof Error ? err.message : '統合に失敗しました',
      };
    }
  }

  return { success: false, error: '不明なアクションです' };
}

export default function AdminMerge() {
  const fetcher = useFetcher<ActionResult>();
  const [sourcePostIds, setSourcePostIds] = useState('');
  const [sourcePosts, setSourcePosts] = useState<SourcePost[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [mergedPostId, setMergedPostId] = useState<number | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    const data = fetcher.data;
    if (!data) return;

    if (data.action === 'loadSources' && data.success && data.sourcePosts) {
      setSourcePosts(data.sourcePosts);
    }
    if (data.action === 'generateDraft' && data.success) {
      setDraftTitle(data.title || '');
      setDraftContent(data.content || '');
    }
    if (data.action === 'executeMerge' && data.success && data.mergedPostId) {
      setMergedPostId(data.mergedPostId);
    }
  }, [fetcher.data]);

  const handleLoadSources = () => {
    const formData = new FormData();
    formData.append('action', 'loadSources');
    formData.append('sourcePostIds', sourcePostIds);
    fetcher.submit(formData, { method: 'post' });
  };

  const handleGenerateDraft = () => {
    const formData = new FormData();
    formData.append('action', 'generateDraft');
    formData.append('sourcePosts', JSON.stringify(sourcePosts));
    fetcher.submit(formData, { method: 'post' });
  };

  const handleExecuteMerge = () => {
    confirmDialogRef.current?.close();
    const formData = new FormData();
    formData.append('action', 'executeMerge');
    formData.append('sourcePostIds', JSON.stringify(sourcePosts.map((p) => p.postId)));
    formData.append('newPostTitle', draftTitle);
    formData.append('newPostContent', draftContent);
    fetcher.submit(formData, { method: 'post' });
  };

  const errorMessage =
    fetcher.data && !fetcher.data.success ? (fetcher.data as any).error : undefined;

  if (mergedPostId) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">記事統合</h1>
        <div className="alert alert-success">
          <div>
            <p className="font-bold">統合が完了しました</p>
            <p>
              新しい記事ID: {mergedPostId} —{' '}
              <Link to={`/archives/${mergedPostId}`} className="link" target="_blank">
                記事を確認する
              </Link>
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary mt-4"
          onClick={() => {
            setMergedPostId(null);
            setSourcePosts([]);
            setDraftTitle('');
            setDraftContent('');
            setSourcePostIds('');
          }}
        >
          別の記事を統合する
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">記事統合</h1>

      {/* Step 1: ソース記事ID入力 */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="card-title text-lg">1. ソース記事を選択</h2>
          <div className="form-control">
            <label className="label" htmlFor="sourcePostIds">
              <span className="label-text">統合する記事のID（カンマ区切り or 改行区切り）</span>
            </label>
            <textarea
              id="sourcePostIds"
              className="textarea textarea-bordered"
              rows={3}
              value={sourcePostIds}
              onChange={(e) => setSourcePostIds(e.target.value)}
              placeholder="例: 12345, 12346, 12347"
            />
          </div>
          <div className="card-actions justify-end">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleLoadSources}
              disabled={isSubmitting || !sourcePostIds.trim()}
            >
              {isSubmitting && fetcher.formData?.get('action') === 'loadSources'
                ? '読み込み中...'
                : '記事を読み込む'}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error mb-4">{errorMessage}</div>}

      {/* Step 2: ソース記事プレビュー */}
      {sourcePosts.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-lg">2. ソース記事のプレビュー</h2>
            <div className="space-y-4">
              {sourcePosts.map((post) => (
                <div key={post.postId} className="collapse collapse-arrow bg-base-200">
                  <input type="checkbox" />
                  <div className="collapse-title font-medium">
                    ID: {post.postId} — {post.postTitle}
                  </div>
                  <div className="collapse-content">
                    <div
                      className="postContent text-sm"
                      dangerouslySetInnerHTML={{ __html: post.postContent }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="card-actions justify-end mt-4">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleGenerateDraft}
                disabled={isSubmitting}
              >
                {isSubmitting && fetcher.formData?.get('action') === 'generateDraft'
                  ? 'AI生成中...'
                  : 'AI下書き生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 統合後記事の編集 */}
      {sourcePosts.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-lg">3. 統合後の記事を編集</h2>
            <div className="form-control mb-4">
              <label className="label" htmlFor="draftTitle">
                <span className="label-text">タイトル</span>
              </label>
              <input
                id="draftTitle"
                type="text"
                className="input input-bordered"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </div>
            <div className="form-control mb-4">
              <label className="label" htmlFor="draftContent">
                <span className="label-text">本文（HTML）</span>
              </label>
              <textarea
                id="draftContent"
                className="textarea textarea-bordered font-mono text-sm"
                rows={15}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              />
            </div>
            {draftContent && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">プレビュー</h3>
                <div className="border rounded p-4 bg-base-200">
                  <h4 className="text-xl font-bold mb-2">{draftTitle}</h4>
                  <div className="postContent" dangerouslySetInnerHTML={{ __html: draftContent }} />
                </div>
              </div>
            )}
            <div className="card-actions justify-end">
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={() => confirmDialogRef.current?.showModal()}
                disabled={isSubmitting || !draftTitle.trim() || !draftContent.trim()}
              >
                統合を実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      <dialog ref={confirmDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">記事統合の確認</h3>
          <p className="py-2 text-sm">
            以下の記事を統合します。この操作はソース記事を検索不可にし、コメント・投票・編集を
            無効化します。
          </p>
          <ul className="list-disc list-inside text-sm mb-4">
            {sourcePosts.map((p) => (
              <li key={p.postId}>
                ID: {p.postId} — {p.postTitle}
              </li>
            ))}
          </ul>
          <p className="text-sm font-bold">統合後のタイトル: {draftTitle}</p>
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => confirmDialogRef.current?.close()}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleExecuteMerge}
              disabled={isSubmitting}
            >
              {isSubmitting ? '統合中...' : '統合を実行'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
