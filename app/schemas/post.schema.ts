import { z } from "zod";

const stopWords = ["発達障害嫁"]

export const createPostFormSchema = (stopWords: string[]) => {
    const checkStopWords = (value: string) => {
        return !stopWords.some((word) => value.includes(word));
      };
    return z.object({
        postCategory: z.enum(["misDeed", "goodDeed"]),
        situations: z.object({
            who: z.string().min(1, { message: "5W1H+Then状況説明>「誰が」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            what: z.string().min(1, { message: "5W1H+Then状況説明>「何を」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            when: z.string().min(1, { message: "5W1H+Then状況説明>「いつ」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            where: z.string().min(1, { message: "5W1H+Then状況説明>「どこで」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }) ,
            why: z.string().min(1, { message: "5W1H+Then状況説明>「なぜ」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            how: z.string().min(1, { message: "5W1H+Then状況説明>「どうやって」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            // biome-ignore lint/suspicious/noThenProperty: <explanation>
            then: z.string().min(1, { message: "5W1H+Then状況説明>「どうなったか」は必須です" }).refine(checkStopWords, { message: "利用できない単語が含まれています" }),
            assumption: z.array(z.string()).optional().refine(
              (value) => value?.every((v) => checkStopWords(v)), { message: "利用できない単語が含まれています" }),
        }),
        reflection: z.array(z.string())
        .superRefine((value, ctx) => {
          if (value.every((v) => v.length < 1)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: '「健常行動ブレイクポイント」もしくは「なぜやってよかったのか」は最低一つ入力してください',
            })
          }
          if (value.some((v) => !checkStopWords(v))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: '利用できない単語が含まれています',
            })
          }
        }),
    
        counterReflection: z.array(z.string())
        .superRefine((value, ctx) => {
          if (value.every((v) => v.length < 1)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: '「どうすればよかったか」もしくは「やらなかったらどうなっていたか」は最低一つ入力してください',
            })
          }
          if (value.some((v) => !checkStopWords(v))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: '利用できない単語が含まれています',
            })
          }
        }),
        note: z.array(z.string()).optional().superRefine((value, ctx) => {
          if (value?.some((v) => !checkStopWords(v))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: '利用できない単語が含まれています',
            })
          }
        }),
        selectedTags: z.array(z.string()).optional(),
        createdTags: z.array(z.string()).optional(),
        title: z.array(z.string())
        .superRefine((value, ctx) => {
          if (value.some((v) => v.includes('#'))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'タイトルに「#」（ハッシュタグ）を含めることはできません。',
            })
          }
    
          if (value.every((v) => v.length < 1)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'タイトルは必須です',
            })
          }
        })

    })
}

export type PostFormInputs = z.infer<ReturnType<typeof createPostFormSchema>>;