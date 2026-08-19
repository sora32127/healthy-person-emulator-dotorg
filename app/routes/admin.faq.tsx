import { useEffect, useState } from 'react';
import { Link, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { asc, eq, max } from 'drizzle-orm';
import ReactMarkdown from 'react-markdown';
import { ChevronUp, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { dimFaqItems } from '~/drizzle/schema';
import { requireAdmin } from '~/modules/admin.server';
import type { CloudflareEnv } from '~/types/env';
import { nowUTC } from '~/drizzle/utils';

// ---------------------------------------------------------------------------
// loader / action
// ---------------------------------------------------------------------------

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

      const [{ m }] = await db.select({ m: max(dimFaqItems.displayOrder) }).from(dimFaqItems);
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

// ---------------------------------------------------------------------------
// 追加・編集で共用するフォーム
// ---------------------------------------------------------------------------

type FaqRow = { faqId: number; question: string; answer: string };

/** Markdown本文のレイアウト用クラス */
const md =
  'break-words [&_p]:my-0 [&_ul]:my-0 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-0 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_a]:text-info [&_a]:underline';

function Form({ faq, onClose, onSaved }: { faq?: FaqRow; onClose?: () => void; onSaved?: () => void }) {
  const f = useFetcher<typeof action>();
  const isEdit = !!faq;
  const busy = f.state !== 'idle';
  const err = f.data && 'error' in f.data ? f.data.error : null;
  const ok = f.data && 'success' in f.data;
  const uid = isEdit ? `e${faq.faqId}` : 'n';
  const [q, setQ] = useState(faq?.question ?? '');
  const [a, setA] = useState(faq?.answer ?? '');

  useEffect(() => {
    if (!ok) return;
    if (isEdit) onClose?.();
    else onSaved?.();
  }, [ok, isEdit, onClose, onSaved]);

  return (
    <form
      method="post"
      className="rounded-xl border border-base-300 bg-base-100 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim() || !a.trim() || busy) return;
        const d = new FormData();
        d.set('intent', isEdit ? 'update' : 'create');
        if (isEdit) d.set('faqId', String(faq.faqId));
        d.set('question', q);
        d.set('answer', a);
        f.submit(d, { method: 'post' });
      }}
    >
      <p className="mb-3 text-sm font-bold">{isEdit ? 'FAQを編集' : '新規FAQ'}</p>

      <div className="grid gap-3">
        <div>
          <label htmlFor={`q-${uid}`} className="mb-1 block text-sm font-medium">
            質問
          </label>
          <input
            id={`q-${uid}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={300}
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label htmlFor={`a-${uid}`} className="mb-1 block text-sm font-medium">
            回答（Markdown対応）
          </label>
          <textarea
            id={`a-${uid}`}
            value={a}
            onChange={(e) => setA(e.target.value)}
            rows={isEdit ? 5 : 4}
            className="textarea textarea-bordered w-full leading-relaxed"
          />
        </div>
        {err && (
          <p role="alert" className="text-sm text-error">
            {err}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-base-200 pt-3">
          {isEdit && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
              キャンセル
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !q.trim() || !a.trim()}>
            {busy ? '保存中...' : isEdit ? '保存する' : '追加する'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 1行分の表示
// ---------------------------------------------------------------------------

function Row({ faq, index, total }: { faq: FaqRow; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const move = useFetcher<typeof action>();
  const del = useFetcher<typeof action>();
  const busy = move.state !== 'idle' || del.state !== 'idle';

  const moveTo = (intent: 'moveUp' | 'moveDown') => {
    const d = new FormData();
    d.set('intent', intent);
    d.set('faqId', String(faq.faqId));
    move.submit(d, { method: 'post' });
  };

  const remove = () => {
    if (!confirm('このFAQを削除しますか？')) return;
    const d = new FormData();
    d.set('intent', 'delete');
    d.set('faqId', String(faq.faqId));
    del.submit(d, { method: 'post' });
  };

  return (
    <li className="flex items-start gap-3 py-4">
      {/* 並び替え */}
      <div className="flex shrink-0 items-center">
        <span
          aria-hidden
          className="w-7 select-none text-right text-xl font-bold leading-none tabular-nums text-base-content/25"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="上へ移動"
            className="rounded p-1 text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content disabled:pointer-events-none disabled:opacity-25"
            disabled={index === 0 || busy || editing}
            onClick={() => moveTo('moveUp')}
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            aria-label="下へ移動"
            className="rounded p-1 text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content disabled:pointer-events-none disabled:opacity-25"
            disabled={index === total - 1 || busy || editing}
            onClick={() => moveTo('moveDown')}
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <Form faq={faq} onClose={() => setEditing(false)} />
        ) : (
          <>
            <p className="break-words font-bold leading-snug">{faq.question}</p>
            <div className={`mt-1 line-clamp-3 text-sm text-base-content/70 ${md}`}>
              <ReactMarkdown>{faq.answer}</ReactMarkdown>
            </div>
          </>
        )}
      </div>

      {/* 操作 */}
      {!editing && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={() => setEditing(true)}>
            <Pencil size={13} /> 編集
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs gap-1 text-error hover:bg-error/10"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 size={13} /> 削除
          </button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// ページ全体
// ---------------------------------------------------------------------------

export default function AdminFaqPage() {
  const { faqs } = useLoaderData<typeof loader>();
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="mx-auto max-w-3xl py-2">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            FAQ管理
            <span className="rounded-full border border-base-300 px-2.5 py-0.5 text-sm font-bold tabular-nums text-base-content/70">
              {faqs.length}件
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-base-content/70">
            「サイト説明」ページ（<code className="rounded bg-base-200 px-1 py-0.5 text-xs">/readme</code>
            ）の「よくある質問」として表示されます。回答はMarkdownで記述でき、左の矢印で並び順を変更できます。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/readme" target="_blank" className="btn btn-ghost btn-sm">
            公開ページを確認
          </Link>
          <button className="btn btn-primary btn-sm gap-1" onClick={() => setAddOpen(!addOpen)}>
            <Plus size={15} /> {addOpen ? '閉じる' : '新規FAQを追加'}
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="mb-6">
          <Form key={`add-${addKey}`} onSaved={() => setAddKey((k) => k + 1)} />
        </div>
      )}

      {faqs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-100/60 py-14 text-center">
          <p className="text-sm font-medium text-base-content/70">まだFAQが登録されていません</p>
          <button className="btn btn-primary btn-sm mt-4 gap-1" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> 新規FAQを追加
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-base-200 rounded-2xl border border-base-300 bg-base-100 px-4 shadow-sm sm:px-6">
          {faqs.map((faq, index) => (
            <Row key={faq.faqId} faq={faq} index={index} total={faqs.length} />
          ))}
        </ol>
      )}
    </div>
  );
}