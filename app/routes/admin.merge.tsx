import { useFetcher, Link } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { requireAdmin } from '~/modules/admin.server';
import { mergePosts, generateMergeDraft } from '~/modules/admin-merge.server';
import type { CloudflareEnv } from '~/types/env';
import { drizzle } from 'drizzle-orm/d1';
import { inArray, isNull, desc } from 'drizzle-orm';
import { dimPosts } from '~/drizzle/schema';
import { getVectorsByIds, querySimilar } from '~/modules/cloudflare.server';

// --- Types ---

type DuplicateCluster = {
  basePostId: number;
  basePostTitle: string;
  similars: { postId: number; postTitle: string; score: number }[];
};

type ScanDuplicatesResult = {
  action: 'scanDuplicates';
  success: boolean;
  clusters?: DuplicateCluster[];
  scannedCount?: number;
  totalCount?: number;
  page?: number;
  error?: string;
};

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

type ActionResult =
  | ScanDuplicatesResult
  | LoadSourcesResult
  | GenerateDraftResult
  | ExecuteMergeResult;

const SCAN_BATCH_SIZE = 20;
const SIMILARITY_THRESHOLD = 0.85;

// --- Action ---

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;

  if (actionType === 'scanDuplicates') {
    const page = Math.max(1, Number(formData.get('page')) || 1);
    const threshold = Number(formData.get('threshold')) || SIMILARITY_THRESHOLD;
    const offset = (page - 1) * SCAN_BATCH_SIZE;

    const db = drizzle(env.DB);

    // 総記事数を取得
    const allPosts = await db
      .select({ postId: dimPosts.postId })
      .from(dimPosts)
      .where(isNull(dimPosts.mergedIntoPostId));
    const totalCount = allPosts.length;

    // バッチ分の記事を取得
    const batchPosts = await db
      .select({ postId: dimPosts.postId, postTitle: dimPosts.postTitle })
      .from(dimPosts)
      .where(isNull(dimPosts.mergedIntoPostId))
      .orderBy(desc(dimPosts.postId))
      .limit(SCAN_BATCH_SIZE)
      .offset(offset);

    if (batchPosts.length === 0) {
      return {
        action: 'scanDuplicates',
        success: true,
        clusters: [],
        scannedCount: 0,
        totalCount,
        page,
      };
    }

    try {
      // 各記事のベクトルを取得して類似検索
      const clusters: DuplicateCluster[] = [];
      const seenPairs = new Set<string>();

      for (const post of batchPosts) {
        const vectors = await getVectorsByIds([String(post.postId)]);
        if (vectors.length === 0 || !vectors[0].values) continue;

        const matches = await querySimilar(vectors[0].values, 10);
        const highScoreMatches = matches
          .filter((m) => {
            const matchId = Number(m.id);
            if (matchId === post.postId) return false;
            if (m.score < threshold) return false;
            // 重複ペアを排除
            const pairKey = [Math.min(post.postId, matchId), Math.max(post.postId, matchId)].join(
              '-',
            );
            if (seenPairs.has(pairKey)) return false;
            seenPairs.add(pairKey);
            return true;
          })
          .map((m) => ({
            postId: Number(m.metadata?.postId ?? m.id),
            postTitle: String(m.metadata?.postTitle ?? ''),
            score: Math.round(m.score * 1000) / 1000,
          }));

        if (highScoreMatches.length > 0) {
          clusters.push({
            basePostId: post.postId,
            basePostTitle: post.postTitle,
            similars: highScoreMatches,
          });
        }
      }

      return {
        action: 'scanDuplicates',
        success: true,
        clusters,
        scannedCount: batchPosts.length,
        totalCount,
        page,
      };
    } catch (err) {
      return {
        action: 'scanDuplicates',
        success: false,
        error: err instanceof Error ? err.message : 'スキャンに失敗しました',
      };
    }
  }

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

// --- Component ---

export default function AdminMerge() {
  const fetcher = useFetcher<ActionResult>();
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [scanPage, setScanPage] = useState(1);
  const [scanMeta, setScanMeta] = useState<{
    scannedCount: number;
    totalCount: number;
  } | null>(null);
  const [threshold, setThreshold] = useState(SIMILARITY_THRESHOLD);
  const [selectedCluster, setSelectedCluster] = useState<{
    postIds: number[];
  } | null>(null);
  const [sourcePosts, setSourcePosts] = useState<SourcePost[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [mergedPostId, setMergedPostId] = useState<number | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    const data = fetcher.data;
    if (!data) return;

    if (data.action === 'scanDuplicates' && data.success) {
      setClusters(data.clusters!);
      setScanMeta({
        scannedCount: data.scannedCount!,
        totalCount: data.totalCount!,
      });
      setScanPage(data.page!);
      setSelectedCluster(null);
      setSourcePosts([]);
      setDraftTitle('');
      setDraftContent('');
    }
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

  const handleScan = (page: number) => {
    const formData = new FormData();
    formData.append('action', 'scanDuplicates');
    formData.append('page', String(page));
    formData.append('threshold', String(threshold));
    fetcher.submit(formData, { method: 'post' });
  };

  const handleSelectCluster = (cluster: DuplicateCluster) => {
    const allIds = [cluster.basePostId, ...cluster.similars.map((s) => s.postId)];
    setSelectedCluster({ postIds: allIds });

    const formData = new FormData();
    formData.append('action', 'loadSources');
    formData.append('sourcePostIds', allIds.join(','));
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

  const resetAll = () => {
    setMergedPostId(null);
    setSourcePosts([]);
    setDraftTitle('');
    setDraftContent('');
    setClusters([]);
    setScanMeta(null);
    setSelectedCluster(null);
  };

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
        <button type="button" className="btn btn-primary mt-4" onClick={resetAll}>
          別の記事を統合する
        </button>
      </div>
    );
  }

  const totalPages = scanMeta ? Math.ceil(scanMeta.totalCount / SCAN_BATCH_SIZE) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">記事統合</h1>

      {/* Step 1: 重複スキャン */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="card-title text-lg">1. 重複記事をスキャン</h2>
          <p className="text-sm opacity-70">
            記事をバッチ処理でベクトル検索し、類似度が閾値以上の記事ペアを検出します。
            1回のスキャンで{SCAN_BATCH_SIZE}件ずつ処理します。
          </p>
          <div className="flex items-end gap-4 mt-2">
            <div className="form-control">
              <label className="label" htmlFor="threshold">
                <span className="label-text">類似度の閾値</span>
              </label>
              <input
                id="threshold"
                type="number"
                step="0.01"
                min="0.5"
                max="1.0"
                className="input input-bordered input-sm w-28"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleScan(1)}
              disabled={isSubmitting}
            >
              {isSubmitting && fetcher.formData?.get('action') === 'scanDuplicates'
                ? 'スキャン中...'
                : 'スキャン開始'}
            </button>
          </div>
          {scanMeta && (
            <p className="text-sm mt-2">
              {scanMeta.totalCount}件中 {(scanPage - 1) * SCAN_BATCH_SIZE + 1}〜
              {Math.min(scanPage * SCAN_BATCH_SIZE, scanMeta.totalCount)}件目をスキャン済み （
              {clusters.length}件の重複候補を検出）
            </p>
          )}
        </div>
      </div>

      {errorMessage && <div className="alert alert-error mb-4">{errorMessage}</div>}

      {/* Step 2: 重複候補一覧 */}
      {clusters.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-lg">2. 重複候補から統合する組を選択</h2>
            <div className="space-y-3">
              {clusters.map((cluster) => (
                <div key={cluster.basePostId} className="border rounded p-3 bg-base-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">
                        <Link
                          to={`/archives/${cluster.basePostId}`}
                          className="link link-hover"
                          target="_blank"
                        >
                          ID:{cluster.basePostId} — {cluster.basePostTitle}
                        </Link>
                      </p>
                      <ul className="ml-4 mt-1">
                        {cluster.similars.map((s) => (
                          <li key={s.postId} className="text-sm flex items-center gap-2">
                            <span
                              className={`badge badge-xs ${s.score >= 0.95 ? 'badge-error' : s.score >= 0.9 ? 'badge-warning' : 'badge-ghost'}`}
                            >
                              {s.score}
                            </span>
                            <Link
                              to={`/archives/${s.postId}`}
                              className="link link-hover"
                              target="_blank"
                            >
                              ID:{s.postId} — {s.postTitle}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSelectCluster(cluster)}
                      disabled={isSubmitting}
                    >
                      この組を統合
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="join mt-4 flex justify-center">
                {scanPage > 1 && (
                  <button
                    type="button"
                    className="join-item btn btn-sm"
                    onClick={() => handleScan(scanPage - 1)}
                    disabled={isSubmitting}
                  >
                    &laquo;
                  </button>
                )}
                <span className="join-item btn btn-sm btn-disabled">
                  {scanPage} / {totalPages}
                </span>
                {scanPage < totalPages && (
                  <button
                    type="button"
                    className="join-item btn btn-sm"
                    onClick={() => handleScan(scanPage + 1)}
                    disabled={isSubmitting}
                  >
                    &raquo;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {scanMeta && clusters.length === 0 && (
        <div className="alert alert-info mb-4">
          このページには類似度 {threshold} 以上の重複候補が見つかりませんでした。
          次のページをスキャンするか、閾値を下げてみてください。
        </div>
      )}

      {/* Step 3: ソース記事プレビュー */}
      {sourcePosts.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-lg">3. ソース記事のプレビュー</h2>
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

      {/* Step 4: 統合後記事の編集 */}
      {sourcePosts.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-lg">4. 統合後の記事を編集</h2>
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
