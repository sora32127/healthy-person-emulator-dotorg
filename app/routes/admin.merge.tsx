import { useFetcher, Link } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { requireAdmin } from '~/modules/admin.server';
import { mergePosts, generateMergeDraft } from '~/modules/admin-merge.server';
import type { CloudflareEnv } from '~/types/env';
import { drizzle } from 'drizzle-orm/d1';
import { inArray, isNull, desc, count } from 'drizzle-orm';
import { dimPosts } from '~/drizzle/schema';
import { getVectorsByIds, querySimilar, deleteVectors } from '~/modules/cloudflare.server';

// --- Types ---

type ScannedPost = {
  postId: number;
  postTitle: string;
  postContent: string;
  score: number;
};

type DuplicateCluster = {
  basePost: ScannedPost;
  similars: ScannedPost[];
};

type ScanDuplicatesResult = {
  action: 'scanDuplicates';
  success: boolean;
  clusters?: DuplicateCluster[];
  scannedCount?: number;
  totalCount?: number;
  page?: number;
  staleVectorCount?: number;
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

type ActionResult = ScanDuplicatesResult | GenerateDraftResult | ExecuteMergeResult;

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

    const [totalResult] = await db
      .select({ count: count() })
      .from(dimPosts)
      .where(isNull(dimPosts.mergedIntoPostId));
    const totalCount = totalResult.count;

    // バッチ分の記事を取得
    const batchPosts = await db
      .select({
        postId: dimPosts.postId,
        postTitle: dimPosts.postTitle,
        postContent: dimPosts.postContent,
      })
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
        staleVectorCount: 0,
      };
    }

    try {
      const clusters: DuplicateCluster[] = [];
      const seenPairs = new Set<string>();
      let staleVectorCount = 0;

      // 現存する全記事IDをSetで持っておく（存在チェック用）
      const allPostIds = await db.select({ postId: dimPosts.postId }).from(dimPosts);
      const existingPostIds = new Set(allPostIds.map((p) => p.postId));

      for (const post of batchPosts) {
        const vectors = await getVectorsByIds([String(post.postId)]);
        if (vectors.length === 0 || !vectors[0].values) continue;

        const matches = await querySimilar(vectors[0].values, 10);

        // 存在しない記事のベクトルを収集して削除
        const staleIds = matches.filter((m) => !existingPostIds.has(Number(m.id))).map((m) => m.id);
        if (staleIds.length > 0) {
          staleVectorCount += staleIds.length;
          try {
            await deleteVectors(staleIds);
          } catch (err) {
            console.error('[admin-merge] stale vector cleanup failed:', err);
          }
        }

        const highScoreMatches = matches.filter((m) => {
          const matchId = Number(m.id);
          if (matchId === post.postId) return false;
          if (!existingPostIds.has(matchId)) return false;
          if (m.score < threshold) return false;
          const pairKey = [Math.min(post.postId, matchId), Math.max(post.postId, matchId)].join(
            '-',
          );
          if (seenPairs.has(pairKey)) return false;
          seenPairs.add(pairKey);
          return true;
        });

        if (highScoreMatches.length > 0) {
          // 類似記事の本文をDBから取得
          const similarPostIds = highScoreMatches.map((m) => Number(m.id));
          const similarPostsData = await db
            .select({
              postId: dimPosts.postId,
              postTitle: dimPosts.postTitle,
              postContent: dimPosts.postContent,
            })
            .from(dimPosts)
            .where(inArray(dimPosts.postId, similarPostIds));

          const similarPostsMap = new Map(similarPostsData.map((p) => [p.postId, p]));

          const similars: ScannedPost[] = highScoreMatches
            .map((m) => {
              const matchId = Number(m.id);
              const dbPost = similarPostsMap.get(matchId);
              if (!dbPost) return null;
              return {
                postId: dbPost.postId,
                postTitle: dbPost.postTitle,
                postContent: dbPost.postContent,
                score: Math.round(m.score * 1000) / 1000,
              };
            })
            .filter((x): x is ScannedPost => x !== null);

          if (similars.length > 0) {
            clusters.push({
              basePost: { ...post, score: 1.0 },
              similars,
            });
          }
        }
      }

      return {
        action: 'scanDuplicates',
        success: true,
        clusters,
        scannedCount: batchPosts.length,
        totalCount,
        page,
        staleVectorCount,
      };
    } catch (err) {
      return {
        action: 'scanDuplicates',
        success: false,
        error: err instanceof Error ? err.message : 'スキャンに失敗しました',
      };
    }
  }

  if (actionType === 'generateDraft') {
    const sourcePostsJson = formData.get('sourcePosts') as string;
    const sourcePosts: { postId: number; postTitle: string; postContent: string }[] =
      JSON.parse(sourcePostsJson);

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

function PostTile({
  post,
  isSelected,
  onToggle,
}: {
  post: ScannedPost;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-base-content/30'
      }`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle();
      }}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
    >
      <div className="p-3 border-b border-base-300 flex items-center gap-2 bg-base-200">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        {post.score < 1.0 && (
          <span
            className={`badge badge-xs ${post.score >= 0.95 ? 'badge-error' : post.score >= 0.9 ? 'badge-warning' : 'badge-ghost'}`}
          >
            {post.score}
          </span>
        )}
        <span className="font-medium text-sm truncate flex-1">{post.postTitle}</span>
        <Link
          to={`/archives/${post.postId}`}
          className="badge badge-outline badge-sm"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          #{post.postId}
        </Link>
      </div>
      <div
        className="p-3 text-xs max-h-48 overflow-y-auto postContent"
        dangerouslySetInnerHTML={{ __html: post.postContent }}
      />
    </div>
  );
}

export default function AdminMerge() {
  const fetcher = useFetcher<ActionResult>();
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [scanPage, setScanPage] = useState(1);
  const [scanMeta, setScanMeta] = useState<{
    scannedCount: number;
    totalCount: number;
    staleVectorCount: number;
  } | null>(null);
  const [threshold, setThreshold] = useState(SIMILARITY_THRESHOLD);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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
        staleVectorCount: data.staleVectorCount ?? 0,
      });
      setScanPage(data.page!);
      setSelectedIds(new Set());
      setDraftTitle('');
      setDraftContent('');
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

  const togglePost = (postId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // 選択中の記事データをclustersから抽出
  const allScannedPosts: ScannedPost[] = clusters.flatMap((c) => [c.basePost, ...c.similars]);
  const selectedPosts = allScannedPosts.filter((p) => selectedIds.has(p.postId));
  // 重複除去
  const uniqueSelectedPosts = [...new Map(selectedPosts.map((p) => [p.postId, p])).values()];

  const handleGenerateDraft = () => {
    const formData = new FormData();
    formData.append('action', 'generateDraft');
    formData.append('sourcePosts', JSON.stringify(uniqueSelectedPosts));
    fetcher.submit(formData, { method: 'post' });
  };

  const handleExecuteMerge = () => {
    confirmDialogRef.current?.close();
    const formData = new FormData();
    formData.append('action', 'executeMerge');
    formData.append('sourcePostIds', JSON.stringify(uniqueSelectedPosts.map((p) => p.postId)));
    formData.append('newPostTitle', draftTitle);
    formData.append('newPostContent', draftContent);
    fetcher.submit(formData, { method: 'post' });
  };

  const errorMessage =
    fetcher.data && !fetcher.data.success ? (fetcher.data as any).error : undefined;

  const resetAll = () => {
    setMergedPostId(null);
    setDraftTitle('');
    setDraftContent('');
    setClusters([]);
    setScanMeta(null);
    setSelectedIds(new Set());
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
            {SCAN_BATCH_SIZE}件ずつベクトル検索し、類似度が閾値以上の記事を検出します。
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
            <div className="text-sm mt-2 space-y-1">
              <p>
                {scanMeta.totalCount}件中 {(scanPage - 1) * SCAN_BATCH_SIZE + 1}〜
                {Math.min(scanPage * SCAN_BATCH_SIZE, scanMeta.totalCount)}件目をスキャン済み（
                {clusters.length}組の重複候補を検出）
              </p>
              {scanMeta.staleVectorCount > 0 && (
                <p className="text-warning">
                  {scanMeta.staleVectorCount}
                  件の不整合ベクトル（削除済み記事）を自動クリーンアップしました
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {errorMessage && <div className="alert alert-error mb-4">{errorMessage}</div>}

      {/* Step 2: 重複候補をタイル表示 */}
      {clusters.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">2. 統合する記事を選択</h2>
              {selectedIds.size >= 2 && (
                <span className="badge badge-primary">{selectedIds.size}件選択中</span>
              )}
            </div>
            <p className="text-sm opacity-70">
              タイルをクリックして統合したい記事を選択してください。記事の中身を確認しながら選べます。
            </p>

            {clusters.map((cluster, idx) => (
              <div key={cluster.basePost.postId} className="mb-6">
                {idx > 0 && <div className="divider" />}
                <p className="text-xs font-bold opacity-50 mb-2">類似グループ #{idx + 1}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <PostTile
                    post={cluster.basePost}
                    isSelected={selectedIds.has(cluster.basePost.postId)}
                    onToggle={() => togglePost(cluster.basePost.postId)}
                  />
                  {cluster.similars.map((s) => (
                    <PostTile
                      key={s.postId}
                      post={s}
                      isSelected={selectedIds.has(s.postId)}
                      onToggle={() => togglePost(s.postId)}
                    />
                  ))}
                </div>
              </div>
            ))}

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

            {/* 選択した記事で次へ */}
            {selectedIds.size >= 2 && (
              <div className="card-actions justify-end mt-4">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerateDraft}
                  disabled={isSubmitting}
                >
                  {isSubmitting && fetcher.formData?.get('action') === 'generateDraft'
                    ? 'AI生成中...'
                    : `${selectedIds.size}件の記事からAI下書き生成`}
                </button>
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

      {/* Step 3: 統合後記事の編集 */}
      {(draftTitle || draftContent) && (
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
            以下の{uniqueSelectedPosts.length}件の記事を統合します。
            ソース記事は検索不可になり、コメント・投票・編集が無効化されます。
          </p>
          <ul className="list-disc list-inside text-sm mb-4">
            {uniqueSelectedPosts.map((p) => (
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
