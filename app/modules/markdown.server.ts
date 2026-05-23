import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { ArchiveDataEntry } from '~/modules/db.server';

const converter = new NodeHtmlMarkdown();

export function htmlToMarkdown(html: string): string {
  return converter.translate(html);
}

export function renderArticleMarkdown(data: ArchiveDataEntry): string {
  const lines: string[] = [];
  const canonicalUrl = `https://healthy-person-emulator.org/archives/${data.postId}`;
  lines.push(`# ${data.postTitle}`);
  lines.push('');
  lines.push(`- URL: ${canonicalUrl}`);
  lines.push(`- 投稿日 (UTC): ${new Date(data.postDateGmt).toISOString()}`);
  lines.push(`- 👍 いいね: ${data.countLikes}`);
  lines.push(`- 👎 よくないね: ${data.countDislikes}`);
  lines.push(`- 🔖 ブックマーク: ${data.countBookmarks}`);
  if (data.tags.length > 0) {
    lines.push(`- タグ: ${data.tags.map((t) => t.tagName).join(', ')}`);
  }
  if (data.isWelcomed === false) {
    lines.push('- ⚠️ コミュニティ判定: 歓迎されない行動として記録されています');
    if (data.isWelcomedExplanation) {
      lines.push(`  - 理由: ${data.isWelcomedExplanation}`);
    }
  }
  lines.push('');
  lines.push('## 本文');
  lines.push('');
  lines.push(htmlToMarkdown(data.postContent));
  lines.push('');

  if (data.comments.length > 0) {
    lines.push('## コメント');
    lines.push('');
    for (const c of data.comments) {
      const date = new Date(c.commentDateGmt).toISOString();
      lines.push(`### ${c.commentAuthor} — ${date}`);
      lines.push('');
      lines.push(`👍 ${c.likesCount} / 👎 ${c.dislikesCount}`);
      lines.push('');
      lines.push(htmlToMarkdown(c.commentContent));
      lines.push('');
    }
  }

  if (data.similarPosts.length > 0) {
    lines.push('## 類似記事');
    lines.push('');
    for (const p of data.similarPosts) {
      lines.push(`- [${p.postTitle}](https://healthy-person-emulator.org/archives/${p.postId})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return /\btext\/markdown\b/i.test(accept);
}

export function markdownResponse(body: string, cacheMaxAgeSec = 300): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheMaxAgeSec}`,
      Vary: 'Accept',
    },
  });
}
