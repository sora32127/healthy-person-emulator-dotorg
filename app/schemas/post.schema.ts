import { z } from 'zod';

export const createPostFormSchema = (stopWords: string[]) => {
  const checkStopWords = (value: string) => {
    return !stopWords.some((word) => value.includes(word));
  };
  return z.object({
    postCategory: z.enum(['misDeed', 'goodDeed', 'wanted']),
    situations: z.object({
      who: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      what: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      when: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      where: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      why: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      how: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      // eslint-disable-next-line unicorn/no-thenable
      then: z.string().min(1, { message: '入力してください' }).refine(checkStopWords, {
        message: '利用できない単語が含まれています',
      }),
      assumption: z
        .array(z.string())
        .optional()
        .refine((value) => value?.every((v) => checkStopWords(v)), {
          message: '利用できない単語が含まれています',
        }),
    }),
    reflection: z.array(z.string()).superRefine((value, ctx) => {
      if (value.every((v) => v.length < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '最低一つ入力してください',
        });
      }
      if (value.some((v) => !checkStopWords(v))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '利用できない単語が含まれています',
        });
      }
    }),

    counterReflection: z.array(z.string()).superRefine((value, ctx) => {
      if (value.every((v) => v.length < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '最低一つ入力してください',
        });
      }
      if (value.some((v) => !checkStopWords(v))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '利用できない単語が含まれています',
        });
      }
    }),
    note: z
      .array(z.string())
      .optional()
      .superRefine((value, ctx) => {
        if (value?.some((v) => !checkStopWords(v))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '利用できない単語が含まれています',
          });
        }
      }),
    selectedTags: z.array(z.string()).optional(),
    createdTags: z.array(z.string()).optional(),
    title: z.array(z.string()).superRefine((value, ctx) => {
      if (value.some((v) => v.includes('#'))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'タイトルに「#」（ハッシュタグ）を含めることはできません。',
        });
      }

      if (value.every((v) => v.length < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'タイトルは必須です',
        });
      }
    }),
  });
};
