import { Link, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useState } from 'react';
import { drizzle } from 'drizzle-orm/d1';
import { asc, eq, max } from 'drizzle-orm';
import { dimFaqItems } from '~/drizzle/schema';
import { requireAdmin } from '~/modules/admin.server';
import type { CloudflareEnv } from '~/types/env';
import { nowUTC } from '~/drizzle/utils';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const db = drizzle(env.DB);

  const faqs = await db
    .select({
      faqId: dimFaqItems.faqId,
      question: dimFaqItems.question,
      answer: dimFaqItems.answer,
      displayOrder: dimFaqItems.displayOrder,
    })
    .from(dimFaqItems)
    .orderBy(asc(dimFaqItems.displayOrder));

  return { faqs };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const db = drizzle(env.DB);

  const formData = await request.formData();
  const intent = formData.get('intent');

  try {
    if (intent === 'create') {
      const question = (formData.get('question') as string)?.trim();
      const answer = (formData.get('answer') as string)?.trim();
      if (!question || !answer) return { error: '質問と回答の両方が必要です' };

      const [{ m }] = await db
        .select({ m: max(dimFaqItems.displayOrder) })
        .from(dimFaqItems);
      const nextOrder = (m ?? 0) + 1;

      await db.insert(dimFaqItems).values({
        question,
        answer,
        displayOrder: nextOrder,
        createdAtUtc: nowUTC(),
        updatedAtUtc: nowUTC(),
      });
      return { success: true };
    }

    const faqId = Number(formData.get('faqId'));
    if (!faqId || Number.isNaN(faqId)) return { error: 'FAQ IDが不正です' };

    if (intent === 'update') {
      const question = (formData.get('question') as string)?.trim();
      const answer = (formData.get('answer') as string)?.trim();
      if (!question || !answer) return { error: '質問と回答の両方が必要です' };

      await db
        .update(dimFaqItems)
        .set({ question, answer, updatedAtUtc: nowUTC() })
        .where(eq(dimFaqItems.faqId, faqId));
      return { success: true };
    }

    if (intent === 'delete') {
      await db.delete(dimFaqItems).where(eq(dimFaqItems.faqId, faqId));
      return { success: true };
    }

    if (intent === 'moveUp' || intent === 'moveDown') {
      const items = await db
        .select({ faqId: dimFaqItems.faqId, displayOrder: dimFaqItems.displayOrder })
        .from(dimFaqItems)
        .orderBy(asc(dimFaqItems.displayOrder));

      const index = items.findIndex((i) => i.faqId === faqId);
      if (index === -1) return { error: '対象のFAQが見つかりません' };

      const swapIndex = intent === 'moveUp' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= items.length) {
        return { error: 'これ以上移動できません' };
      }

      const target = items[index];
      const neighbor = items[swapIndex];

      await db
        .update(dimFaqItems)
        .set({ displayOrder: neighbor.displayOrder, updatedAtUtc: nowUTC() })
        .where(eq(dimFaqItems.faqId, target.faqId));
      await db
        .update(dimFaqItems)
        .set({ displayOrder: target.displayOrder, updatedAtUtc: nowUTC() })
        .where(eq(dimFaqItems.faqId, neighbor.faqId));

      return { success: true };
    }

    return { error: '操作が不正です' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FAQの更新に失敗しました';
    return { error: message };
  }
}

type FaqRow = {
  faqId: number;
  question: string;
  answer: string;
  displayOrder: number;
};

function FaqForm({
  faq,
  onDone,
}: {
  faq?: FaqRow;
  onDone?: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== 'idle';
  const isEdit = !!faq;
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null;
  const success = fetcher.data && 'success' in fetcher.data;

  return (
    <fetcher.Form method="post" className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <input type="hidden" name="intent" value={isEdit ? 'update' : 'create'} />
        {isEdit && <input type="hidden" name="faqId" value={faq.faqId} />}

        <div className="form-control">
          <label className="label" htmlFor={`question-${isEdit ? faq.faqId : 'new'}`}>
            <span className="label-text">質問</span>
          </label>
          <input
            id={`question-${isEdit ? faq.faqId : 'new'}`}
            name="question"
            type="text"
            className="input input-bordered input-sm"
            defaultValue={faq?.question}
            required
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor={`answer-${isEdit ? faq.faqId : 'new'}`}>
            <span className="label-text">回答（Markdown対応）</span>
          </label>
          <textarea
            id={`answer-${isEdit ? faq.faqId : 'new'}`}
            name="answer"
            className="textarea textarea-bordered"
            rows={isEdit ? 4 : 3}
            defaultValue={faq?.answer}
            required
          />
        </div>

        {error && (
          <div className="alert alert-error text-sm py-2" role="alert">
            {error}
          </div>
        )}
        {success && !isEdit && (
          <div className="alert alert-success text-sm py-2">追加しました</div>
        )}
        {success && isEdit && (
          <div className="alert alert-success text-sm py-2">保存しました</div>
        )}

        <div className="card-actions justify-end">
          <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : isEdit ? '保存' : '追加'}
          </button>
          {isEdit && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
              閉じる
            </button>
          )}
        </div>
      </div>
    </fetcher.Form>
  );
}

function FaqRowItem({ faq, index, total }: { faq: FaqRow; index: number; total: number }) {
  const editFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const moveFetcher = useFetcher<typeof action>();
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex gap-2 items-start">
      <div className="flex flex-col gap-1 pt-1">
        <editFetcher.Form method="post">
          <input type="hidden" name="intent" value="moveUp" />
          <input type="hidden" name="faqId" value={faq.faqId} />
          <button
            type="submit"
            className="btn btn-ghost btn-xs"
            aria-label="上へ移動"
            disabled={index === 0 || moveFetcher.state !== 'idle'}
          >
            ↑
          </button>
        </editFetcher.Form>
        <editFetcher.Form method="post">
          <input type="hidden" name="intent" value="moveDown" />
          <input type="hidden" name="faqId" value={faq.faqId} />
          <button
            type="submit"
            className="btn btn-ghost btn-xs"
            aria-label="下へ移動"
            disabled={index === total - 1 || moveFetcher.state !== 'idle'}
          >
            ↓
          </button>
        </editFetcher.Form>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <FaqForm faq={faq} onDone={() => setEditing(false)} />
        ) : (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{index + 1}. {faq.question}</p>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => setEditing(true)}
                  >
                    編集
                  </button>
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="faqId" value={faq.faqId} />
                    <button
                      type="submit"
                      className="btn btn-error btn-xs"
                      onClick={(e) => {
                        if (!confirm('このFAQを削除しますか？')) e.preventDefault();
                      }}
                    >
                      削除
                    </button>
                  </deleteFetcher.Form>
                </div>
              </div>
              <p className="text-sm opacity-70 whitespace-pre-wrap">{faq.answer}</p>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function AdminFaqPage() {
  const { faqs } = useLoaderData<typeof loader>();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">FAQ管理 ({faqs.length}件)</h1>
        <div className="flex gap-2">
          <Link to="/readme" target="_blank" className="btn btn-ghost btn-sm">
            公開ページを確認
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? '閉じる' : 'FAQを追加'}
          </button>
        </div>
      </div>

      <p className="text-sm opacity-70 mb-4">
        「サイト説明」ページ（<code>/readme</code>）の「よくある質問」に表示されます。
        回答はMarkdown形式で記述できます。並び順は↑↓ボタンで変更できます。
      </p>

      {showAdd && (
        <div className="mb-6">
          <FaqForm />
        </div>
      )}

      {faqs.length === 0 ? (
        <p className="text-sm opacity-60">FAQが登録されていません。「FAQを追加」から追加してください。</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {faqs.map((faq, index) => (
            <FaqRowItem key={faq.faqId} faq={faq} index={index} total={faqs.length} />
          ))}
        </ol>
      )}
    </div>
  );
}
