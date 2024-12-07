import { useForm, type SubmitHandler, FormProvider, useFormContext, useWatch, useFieldArray, useFormState, FieldErrors } from "react-hook-form"
import { useEffect, useState } from "react"
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, json, NavLink, useLoaderData } from "@remix-run/react";
import UserExplanation from "~/components/SubmitFormComponents/UserExplanation";
import ClearFormButton from "~/components/SubmitFormComponents/ClearFormButton";
import { H3 } from "~/components/Headings";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { getTagsCounts } from "~/modules/db.server";
import TagCreateBox from "~/components/SubmitFormComponents/TagCreateBox";
import TagPreviewBox from "~/components/SubmitFormComponents/TagPreviewBox";

const postFormSchema = z.object({
    postCategory: z.enum(["misDeed", "goodDeed"]),
    situations: z.object({
        who: z.string().min(3, { message: "5W1H+Then状況説明>「誰が」は必須です" }),
        what: z.string().min(3, { message: "5W1H+Then状況説明>「何を」は必須です" }),
        when: z.string().min(3, { message: "5W1H+Then状況説明>「いつ」は必須です" }),
        where: z.string().min(3, { message: "5W1H+Then状況説明>「どこで」は必須です" }),
        why: z.string().min(3, { message: "5W1H+Then状況説明>「なぜ」は必須です" }),
        how: z.string().min(3, { message: "5W1H+Then状況説明>「どうやって」は必須です" }),
        // biome-ignore lint/suspicious/noThenProperty: <explanation>
        then: z.string().min(1, { message: "5W1H+Then状況説明>「どうなったか」は必須です" }),
        assumption: z.array(z.string()).optional(),
    }),
    reflection: z.array(z.string()).min(1, { message: "「健常行動ブレイクポイント」もしくは「なぜやってよかったのか」は最低一つ入力してください" }),
    counterReflection: z.array(z.string()).min(1, { message: "「どうすればよかったか」もしくは「やらなかったらどうなっていたか」は最低一つ入力してください" }),
    note: z.array(z.string()).optional(),
    selectedTags: z.array(z.string()).optional(),
    createdTags: z.array(z.string()).optional(),
    title: z.array(z.string()).min(3, { message: "タイトルは必須です" }),
});

type Inputs = z.infer<typeof postFormSchema>;

export async function loader () {
  const CFTurnstileSiteKey = process.env.CF_TURNSTILE_SITEKEY || "";
  const tags = await getTagsCounts();

  return json({ CFTurnstileSiteKey,  tags });
}

export default function App() {
  const { CFTurnstileSiteKey, tags } = useLoaderData<typeof loader>();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<string[]>([]);

  const handleTagSelection = (tags: string[]) => {
    setSelectedTags(tags);
    window.localStorage.setItem('selectedTags', JSON.stringify(tags));
    methods.setValue("selectedTags", tags);
  }

  const handleTagCreated = (tag: string) => {
    setCreatedTags([...createdTags, tag]);
    window.localStorage.setItem('createdTags', JSON.stringify([...createdTags, tag]));
    methods.setValue("createdTags", [...createdTags, tag]);
  }

  const handleTagRemoved = (tag: string) => {
    setCreatedTags(createdTags.filter((t) => t !== tag));
    window.localStorage.setItem('createdTags', JSON.stringify(createdTags.filter((t) => t !== tag)));
    methods.setValue("createdTags", createdTags.filter((t) => t !== tag));
  }

  
  
  const formId = "post-form";

  const onSubmit: SubmitHandler<Inputs> = (data) => console.log(data);
  const getStoredValues = (): Inputs => {
    if (typeof window === "undefined") return { title: "", postCategory: "misDeed" };
    const stored = window.localStorage.getItem(formId);
    return stored ? JSON.parse(stored) : { title: "", postCategory: "misDeed" };
  }

  const methods = useForm({
    defaultValues: getStoredValues(),
    resolver: zodResolver(postFormSchema),
  });

  const clearInputs = () => {
    methods.reset();
    window.localStorage.removeItem(formId);
    window.location.reload();
  }

  useEffect(() => {
    setInterval(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(formId, JSON.stringify(methods.getValues()));
      }
    }, 5000);
  }, [methods.getValues]);

  const postCategory = methods.watch("postCategory");;

  return (
    <>
    <div className="templateSubmitForm">
    <FormProvider {...methods}> 
      <Form method="post" onSubmit={methods.handleSubmit(onSubmit)}>
        <UserExplanation />
        <br/>
        <NavLink
            className="inline-block align-baseline font-bold text-sm text-info underline underline-offset-4"
            to="/freeStylePost"
        >自由投稿フォームに移動</NavLink>
        <div className="flex justify-start mt-6">
          <ClearFormButton clearInputs={clearInputs}/>
        </div>
        <br/>
        <TextTypeSwitcher />
        <SituationInput />
        <DynamicTextInput description="書ききれなかった前提条件はありますか？" key="situations.assumption" />

        {postCategory === "misDeed" ? (
            <>
            <StaticTextInput
                rowNumber={3}
                title="健常行動ブレイクポイント"
                placeholders={["友人の言動は冗談だという事に気が付く必要があった","会話の中で自分がされた時に困るようなフリは避けるべきである"]}
                description="上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。"
                registerKey="reflection"
            />
            <StaticTextInput
                rowNumber={3}
                title="どうすればよかったか"
                placeholders={["冗談に対してただ笑うべきだった","詠ませた後もその句を大げさに褒めるなどして微妙な空気にさせないべきだった"]}
                description="5W1H状況説明、健常行動ブレイクポイントを踏まえ、どのようにするべきだったかを提示します。"
                registerKey="counterReflection"
            />
            </>
        ) : (
            <>
            <StaticTextInput
                rowNumber={3}
                title='なぜやってよかったのか'
                placeholders={["一般的に料理とは手間のかかる作業であり、相手がかけてくれた手間に対して何らかの形で報いること、もしくは報いる意思を示すことは相手に対して敬意を表していることと等しい。","敬意はコミュニケーションに対して良い作用をもたらす"]}
                description='上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。'
                registerKey="reflection"
            />
            <StaticTextInput
                rowNumber={3}
                title='やらなかったらどうなっていたか'
                placeholders={["相手がかけた手間に対して敬意を払わないことは相手を無下に扱っていることと等しい。", "関係が改善されることはなく、状況が悪ければ破局に至っていたかもしれない"]}
                description='仮に上で記述した行動を実行しなかった場合、どのような不利益が起こりうるか記述してください。推論の範囲内で構わない。'
                registerKey="counterReflection"
            />
            </>
        )}
        <StaticTextInput
            rowNumber={3}
            title='備考'
            description='書ききれなかったことを書きます'
            placeholders={postCategory === "misDeed" ? ["友人が詠んだ句は「ため池や 水がいっぱい きれいだね」だった"] : ["舌が過度に肥えてしまい、コンビニ弁当が食べられなくなった。"]}
            registerKey="note"
        />
        <TagSelectionBox allTagsOnlyForSearch={tags} onTagsSelected={handleTagSelection} parentComponentStateValues={selectedTags} />
        <TagCreateBox
            handleTagCreated={handleTagCreated}
            handleTagRemoved={handleTagRemoved}
            parentComponentStateValues={createdTags}
        /> 
        <TagPreviewBox selectedTags={selectedTags} createdTags={createdTags}/>
        <StaticTextInput
            rowNumber={1}
            title="タイトル"
            description="タイトルを入力してください"
            placeholders={["タイトル"]}
            registerKey="title"
        />
      </Form>
      </FormProvider>
    </div>
    </>
  )
}




function TextTypeSwitcher(){
    const { register } = useFormContext();
    return (
        <div className="mb-4">
            <H3>投稿タイプを選択</H3>
            <p>投稿したい経験知の種類を選択してください。</p>
            <div className="flex mt-4">
                <input type="radio" id="misDeed" value="misDeed" {...register("postCategory")} />
                <label htmlFor="misDeed">結果悪</label>
                <input type="radio" id="goodDeed" value="goodDeed" {...register("postCategory")} />
                <label htmlFor="goodDeed">結果善</label>
            </div>
        </div>
    )
}


function SituationInput(){
    const { register } = useFormContext();
    const { control } = useFormContext();
    const postCategory = useWatch({ control, name: "postCategory" });

    const placeholder = postCategory === "misDeed" ? [
        {
            key: "who",
            description: "その状況の「主役」は誰ですか？(Who)",
            placeholder: "自分が",
            rows: 1,
          },
          {
            key: "when",
            description: "いつ起こったことですか？(When)",
            placeholder: "友人と公園にいた時",
            rows: 1,
          },
          {
            key: "where",
            description: "どこで起こったことですか？(Where)",
            placeholder: "池の前で",
            rows: 1,
          },
          {
            key: "why",
            description: "なぜそのような行動をしたのですか？(Why)",
            placeholder:
              "「詠めそう」と言われたらそう返すのが自然な会話の流れだと思ったから",
            rows: 2,
          },
          {
            key: "what",
            description: "その主役は、何に対してはたらきかけましたか？(What)",
            placeholder: "友人に",
            rows: 1,
          },
          {
            key: "how",
            description: "その主役は、対象をどうしましたか？(How)",
            placeholder: "「詠んでみてよ」と言った",
            rows: 1,
          },
          {
            key: "then",
            description: "行動の結果としてどうなりましたか？(Then)",
            placeholder: "友人が微妙な句を詠み、微妙な空気になった",
            rows: 3,
          },
        ]
      : [
          {
            key: "who",
            description: "その状況の「主役」は誰ですか？(Who)",
            placeholder: "筆者が",
            rows: 1,
          },
          {
            key: "when",
            description: "いつ起こったことですか？(When)",
            placeholder: "コロナで同居人が家にいる時間が増えた時",
            rows: 1,
          },
          {
            key: "where",
            description: "どこで起こったことですか？(Where)",
            placeholder: "家で",
            rows: 1,
          },
          {
            key: "why",
            description: "なぜそのような行動をしたのですか？(Why)",
            placeholder: "おいしいと思ったため",
            rows: 2,
          },
          {
            key: "what",
            description: "その主役は、何に対してはたらきかけましたか？(What)",
            placeholder: "同居人が作ってくれる料理について",
            rows: 1,
          },
          {
            key: "how",
            description: "その主役は、対象をどうしましたか？(How)",
            placeholder: "相手に直接「おいしい」と伝えるようにした",
            rows: 1,
          },
          {
            key: "then",
            description: "行動の結果としてどうなりましたか？(Then)",
            placeholder:
              "相手の料理の腕が上がり、どんどん料理がおいしくなり、関係も改善された",
            rows: 3,
          },
        ];

    return (
        <div className="mb-8">
            <H3>5W1H+Then状況説明</H3>
            {placeholder.map((data, index) => {
                return (
                    <div key={data.key} className="mb-4">
                        <label
                            htmlFor={data.key}
                            className="block font-bold mb-2"
                        >
                            {data.description}
                        </label>
                        <textarea
                            id={data.key}
                            placeholder={data.placeholder}
                            rows={data.rows}
                            className="w-full px-3 py-2 text-base-content border rounded-lg focus:outline-none placeholder-slate-500"
                            {...register(`situations.${data.key}`)}
                        />
                    </div>
                )
            })}
        </div>
    )
}

function DynamicTextInput({ description, registerKey = "situations.assumption" }: {description: string, registerKey?: string}){
    const { register, control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: registerKey,
    });
    return (
      <div className="mb-8">
        <H3>{description}</H3>
        <div className="flex mb-4 flex-col">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-row my-2">
              <input key={field.id} {...register(`${registerKey}.${index}`)} className="w-3/4 border rounded-lg placeholder-slate-500 px-3 py-2" />
              <button type="button" onClick={() => remove(index)} className="bg-error text-error-content rounded-lg px-3 mx-3">削除</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => append("")} className="bg-info text-info-content px-3 py-2 rounded-lg">追加</button>
      </div>
    )
}

function StaticTextInput({ rowNumber, title, placeholders, description, registerKey }: { rowNumber: number, title: string, placeholders: string[], description: string, registerKey: string }){
    const { register } = useFormContext();
    const renderTextInputs = () => {
        const inputs = [];
        for (let i = 0; i < rowNumber; i++) {
            inputs.push(
                <textarea
                    key={`${title}-input-${i}`}
                    className="flex-grow px-3 py-2 border rounded-lg focus:outline-none w-full my-2 placeholder-slate-500"
                    placeholder={placeholders[i]}
                    {...register(`${registerKey}.${i}`)}
                />
            )
        }
        return inputs;
    }
    return (
        <div className="mb-8">
            <H3>{title}</H3>
            <p>{description}</p>
            <div className="flex items-center space-x-2 mb-4 flex-col">
                {renderTextInputs()}             
            </div>
        </div>
    )
}