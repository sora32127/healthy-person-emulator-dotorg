import { z } from 'zod';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { createPostFormSchema } from '~/schemas/post.schema';

function removeEmptyString(array: string[] | undefined): string[] {
  if (!array) return [];
  return array.filter((value) => !/^\s*$/.test(value));
}

export interface WikifyResult {
  success: boolean;
  data?: { WikifiedResult: string; MarkdownResult: string };
  error?: unknown;
}

export function wikify(
  postData: z.infer<ReturnType<typeof createPostFormSchema>>,
  postFormSchema: ReturnType<typeof createPostFormSchema>,
): WikifyResult {
  const validationResult = postFormSchema.safeParse(postData);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.errors,
    };
  }

  const { who, when, where, why, what, how, then, assumption } = validationResult.data.situations;
  const { reflection, counterReflection } = validationResult.data;
  const { note, postCategory } = validationResult.data;

  const result = `
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
          ?.map((assumption) => `<li>${assumption}</li>`)
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
        ?.map((reflection) => `<li>${reflection}</li>`)
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
        ?.map((counterReflection) => `<li>${counterReflection}</li>`)
        .join('\n')}
    </ul>
    ${
      removeEmptyString(note)?.length > 0
        ? `
      <h3>備考</h3>
      <ul>
        ${removeEmptyString(note)
          ?.map((note) => `<li>${note}</li>`)
          .join('\n')}
      </ul>
    `
        : ''
    }
  `;
  const markdownContent = NodeHtmlMarkdown.translate(result);
  return {
    success: true,
    data: { WikifiedResult: result, MarkdownResult: markdownContent },
  };
}
