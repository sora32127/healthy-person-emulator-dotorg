import {
  useForm,
  FormProvider,
  useFormContext,
  useWatch,
  useFieldArray,
} from "react-hook-form";
import { useEffect, useState } from "react";
// biome-ignore lint/style/useImportType: <explanation>
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import { data } from "@remix-run/node";
import UserExplanation from "~/components/SubmitFormComponents/UserExplanation";
import ClearFormButton from "~/components/SubmitFormComponents/ClearFormButton";
import { H1, H3 } from "~/components/Headings";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import {
  getStopWords,
  getTagsCounts,
  prisma,
  updatePostWelcomed,
} from "~/modules/db.server";
import TagCreateBox from "~/components/SubmitFormComponents/TagCreateBox";
import TagPreviewBox from "~/components/SubmitFormComponents/TagPreviewBox";
import { Modal } from "~/components/Modal";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { createEmbedding } from "~/modules/embedding.server";
import { FaCopy } from "react-icons/fa";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { toast, Toaster } from "react-hot-toast";
import { createPostFormSchema } from "~/schemas/post.schema";
import {
  getHashedUserIPAddress,
  getJudgeWelcomedByGenerativeAI,
  getTurnStileSiteKey,
  validateRequest,
} from "~/modules/security.server";
import { commitSession, getSession, isUserValid } from "~/modules/session.server";
import { Turnstile } from "@marsidev/react-turnstile";
import { MakeToastMessage } from "~/utils/makeToastMessage";

export async function loader({ request }: LoaderFunctionArgs) {
  const tags = await getTagsCounts();
  const stopWords = await getStopWords();
  const isValid = await isUserValid(request);
  const turnStileSiteKey = await getTurnStileSiteKey();
  return ({ tags, stopWords, isValid, turnStileSiteKey });
}

export default function App() {
  const { tags, stopWords, turnStileSiteKey } = useLoaderData<typeof loader>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<string[]>([]);

  const postFormSchema = createPostFormSchema(stopWords);

  const handleTagSelection = (tags: string[]) => {
    setSelectedTags(tags);
    window.localStorage.setItem("selectedTags", JSON.stringify(tags));
    methods.setValue("selectedTags", tags);
  };

  const handleTagCreated = (tag: string) => {
    setCreatedTags([...createdTags, tag]);
    window.localStorage.setItem(
      "createdTags",
      JSON.stringify([...createdTags, tag])
    );
    methods.setValue("createdTags", [...createdTags, tag]);
  };

  const handleTagRemoved = (tag: string) => {
    setCreatedTags(createdTags.filter((t) => t !== tag));
    window.localStorage.setItem(
      "createdTags",
      JSON.stringify(createdTags.filter((t) => t !== tag))
    );
    methods.setValue(
      "createdTags",
      createdTags.filter((t) => t !== tag)
    );
  };

  const formId = "post-form";
  type Inputs = z.infer<typeof postFormSchema>;

  const getStoredValues = (): Inputs => {
    if (typeof window === "undefined")
      return {
        title: [],
        postCategory: "misDeed",
        situations: {
          who: "",
          what: "",
          when: "",
          where: "",
          why: "",
          how: "",
          // biome-ignore lint/suspicious/noThenProperty: <explanation>
          then: "",
        },
        reflection: [],
        counterReflection: [],
        note: [],
        selectedTags: [],
        createdTags: [],
      };
    const stored = window.localStorage.getItem(formId);
    return stored
      ? JSON.parse(stored)
      : {
          title: [],
          postCategory: "misDeed",
          situations: {
            who: "",
            what: "",
            when: "",
            where: "",
            why: "",
            how: "",
            // biome-ignore lint/suspicious/noThenProperty: <explanation>
            then: "",
          },
          reflection: [],
          counterReflection: [],
          note: [],
          selectedTags: [],
          createdTags: [],
        };
  };

  const methods = useForm({
    defaultValues: getStoredValues(),
    resolver: zodResolver(postFormSchema),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          formId,
          JSON.stringify(methods.getValues())
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [methods.getValues]);

  const postCategory = methods.watch("postCategory");

  const turnstileFetcher = useFetcher();
  const handleTurnStileSuccess = (token: string) => {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("_action", "validateTurnstile");
    turnstileFetcher.submit(formData, { method: "post", action: "/post" });
  };

  useEffect(() => {
    const response = turnstileFetcher.data as { success: boolean };
    if (response?.success === false) {
      toast.error("リクエスト検証に失敗しました。時間をおいて再度お試しください。");
    }
    if (response?.success === true) {
      setIsFirstSubmitButtonOpen(true);
    }
  }, [turnstileFetcher.data]);

  const firstSubmitFetcher = useFetcher();
  const handleFirstSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const inputValues = methods.getValues();
    const zodErrors = postFormSchema.safeParse(inputValues);
    if (!zodErrors.success) {
      const toastValidationMessage = MakeToastMessage(zodErrors.error.issues);
      toast.error(toastValidationMessage);
      return;
    }

    const formData = new FormData();
    formData.append("_action", "firstSubmit");
    for (const [key, value] of Object.entries(inputValues)) {
      formData.append(key, JSON.stringify(value));
    }
    firstSubmitFetcher.submit(formData, {
      method: "post",
      action: "/post",
    });
  };

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isFirstSubmitButtonOpen, setIsFirstSubmitButtonOpen] = useState(false);

  useEffect(() => {
    const response = firstSubmitFetcher.data as { success: boolean };
    if (response?.success) {
      setIsPreviewModalOpen(true);
    }
    if (response?.success === false) {
      toast.error("プレビューを取得できませんでした。時間をおいて再度試してください。");
    }
  }, [firstSubmitFetcher.data]);

  useEffect(() => {
    if (firstSubmitFetcher.state === "submitting") {
      toast.loading("プレビューを取得しています");
    }
    if (firstSubmitFetcher.state === "submitting") {
      setIsFirstSubmitButtonOpen(false);
    }
    if (firstSubmitFetcher.state === "loading") {
      setIsFirstSubmitButtonOpen(true);
      toast.dismiss();// ローディング中のトーストを消す
    }
  }, [firstSubmitFetcher.state]);

  const handleCopy = () => {
    const response = firstSubmitFetcher.data as { 
      data: { 
        data: { 
          MarkdownResult: string 
        } 
      } 
    };
    try {
      navigator.clipboard.writeText(response?.data?.data?.MarkdownResult);
      toast.success("クリップボードにコピーしました。");
    } catch (error) {
      toast.error("クリップボードにコピーできませんでした。");
    }
  }

  const secondSubmitFetcher = useFetcher();
  const handleSecondSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("_action", "secondSubmit");
    for (const [key, value] of Object.entries(methods.getValues())) {
      formData.append(key, JSON.stringify(value));
    }
    secondSubmitFetcher.submit(formData, { method: "post", action: "/post" });
  }
  const [isSecondSubmitButtonOpen, setIsSecondSubmitButtonOpen] = useState(true);
  
  useEffect(() => {
    if (secondSubmitFetcher.state === "submitting") {
      setIsSecondSubmitButtonOpen(false);
      toast.loading("投稿中です...")
    }
    if (secondSubmitFetcher.state === "loading" && (secondSubmitFetcher.data as { success: boolean })?.success === true) {
      toast.dismiss();
    }
  }, [secondSubmitFetcher.state, secondSubmitFetcher.data]);

  const navigate = useNavigate();
  useEffect(() => {
    const response = secondSubmitFetcher.data as { success: boolean, data: { postId: number } };
    if (response?.success === true && secondSubmitFetcher.state === "idle") {
      handleClearForm();
      toast.success("投稿しました。リダイレクトします...", {
        icon: "🎉",
        id: "post-success-toast",
      })
      setTimeout(() => {
        const postId = response?.data?.postId;
        navigate(`/archives/${postId}`, { viewTransition: true });
      }, 2000);
    }
    return () => {
      toast.dismiss("post-success-toast");
    }
  }, [secondSubmitFetcher.data, navigate, secondSubmitFetcher.state]);

  const handleClearForm = () => {
    window.localStorage.removeItem(formId);
    window.localStorage.removeItem("selectedTags");
    window.localStorage.removeItem("createdTags");
    methods.reset({
      title: [""],
      postCategory: "misDeed",
      situations: {
        who: "",
        what: "",
        when: "",
        where: "",
        why: "",
        how: "",
        // biome-ignore lint/suspicious/noThenProperty: <explanation>
        then: "",
      },
      reflection: ["", "", ""],
      counterReflection: ["", "", ""],
      note: ["", "", ""],
      selectedTags: [],
      createdTags: [],
    });
    
    setSelectedTags([]);
    setCreatedTags([]);
  }

  return (
    <>
      <div className="templateSubmitForm">
        <FormProvider {...methods}>
          <Toaster />
          <Form method="post">
            <UserExplanation />
            <br />
            <div className="flex justify-start mt-6">
              <ClearFormButton clearInputs={handleClearForm} />
            </div>
            <br />
            <TextTypeSwitcher />
            <SituationInput />
            <DynamicTextInput
              description="書ききれなかった前提条件はありますか？"
              key="situations.assumption"
            />

            {postCategory === "misDeed" ? (
              <>
                <StaticTextInput
                  rowNumber={3}
                  title="健常行動ブレイクポイント"
                  placeholders={[
                    "友人の言動は冗談だという事に気が付く必要があった",
                    "会話の中で自分がされた時に困るようなフリは避けるべきである",
                  ]}
                  description="上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。"
                  registerKey="reflection"
                />
                <StaticTextInput
                  rowNumber={3}
                  title="どうすればよかったか"
                  placeholders={[
                    "冗談に対してただ笑うべきだった",
                    "詠ませた後もその句を大げさに褒めるなどして微妙な空気にさせないべきだった",
                  ]}
                  description="5W1H状説明、健常行動ブレイクポイントを踏まえ、どのようにするべきだったかを提示します。"
                  registerKey="counterReflection"
                />
              </>
            ) : postCategory === "goodDeed" ? (
              <>
                <StaticTextInput
                  rowNumber={3}
                  title="なぜやってよかったのか"
                  placeholders={[
                    "一般的に料理とは手間のかかる作業であり、相手がかけてくれた手間に対して何らかの形で報いること、もしくは報いる意思を示すことは相手に対して敬意を表していることと等しい。",
                    "敬意はコミュニケーションに対して良い作用をもたらす",
                  ]}
                  description="上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。"
                  registerKey="reflection"
                />
                <StaticTextInput
                  rowNumber={3}
                  title="やらなかったらどうなっていたか"
                  placeholders={[
                    "相手がかけた手間に対して敬意をわないことは相手を無下に扱っていることと等しい。",
                    "関係が改善されることはなく、状況が悪ければ破局に至っていたかもしれない",
                  ]}
                  description="仮に上で記述した行動を実行しなかった場合、どのような不利益が起こりうるか記述してください。推論の範囲内で構わない。"
                  registerKey="counterReflection"
                />
              </>
            ) : postCategory === "wanted" ? (
              <>
                <StaticTextInput
                  rowNumber={3}
                  title="試したこと"
                  placeholders={[
                    "趣味の話をしたことがあるが、筆者の趣味はかなりマイナー趣味であり、反応が何もなかった",
                  ]}
                  description="考えたり実行したり、試してみたことを説明します。できる範囲で記述して下さい。"
                  registerKey="reflection"
                />
                <StaticTextInput
                  rowNumber={3}
                  title="まだやってないこと"
                  placeholders={[
                    "天気の話題を話そうかと思ったが、自己紹介の時に話すのは違う気がした",
                  ]}
                  description="解決策として考えたが、まだ実行していない考えを記述してください。ない場合は「ない」と明記してください。"
                  registerKey="counterReflection"
                />
              </>
            ) : null}
            <StaticTextInput
              rowNumber={3}
              title="備考"
              description="書ききれなかったことを書きます"
              placeholders={
                postCategory === "misDeed"
                  ? [
                      "友人が詠んだ句は「ため池や 水がいっぱい きれいだね」だった",
                    ]
                  : [
                      "舌が過度に肥えてしまい、コンビニ弁当が食べられなくなった。",
                    ]
              }
              registerKey="note"
            />
            <TagSelectionBox
              allTagsOnlyForSearch={tags}
              onTagsSelected={handleTagSelection}
              parentComponentStateValues={selectedTags}
            />
            <TagCreateBox
              handleTagCreated={handleTagCreated}
              handleTagRemoved={handleTagRemoved}
              parentComponentStateValues={createdTags}
            />
            <TagPreviewBox
              selectedTags={selectedTags}
              createdTags={createdTags}
            />
            <StaticTextInput
              rowNumber={1}
              title="タイトル"
              description="タイトルを入力してください"
              placeholders={["タイトル"]}
              registerKey="title"
            />
        <div className="flex justify-end">
          <div className="flex flex-col items-center gap-1 p-2">
            <Turnstile
              siteKey={turnStileSiteKey}
              onSuccess={handleTurnStileSuccess}
            />
            <button
              type="submit"
              className="btn btn-primary disabled:btn-disabled"
              onClick={handleFirstSubmit}
              disabled={!isFirstSubmitButtonOpen}
            >
              投稿する
            </button>
            </div>
            <Modal
              isOpen={isPreviewModalOpen}
              onClose={() => setIsPreviewModalOpen(false)}
              title="投稿する内容を確認してください。"
              showCloseButton={false}
            >
              <div className="postContent previewContainer">
                <H1>{(firstSubmitFetcher?.data as { data: { title: string } })?.data?.title}</H1>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
                <div dangerouslySetInnerHTML={{ 
                  __html: (firstSubmitFetcher?.data as { data: { data: { WikifiedResult: string } } })?.data?.data?.WikifiedResult 
                }} />
              </div>
              <div className="flex justify-between items-center mt-6 border-t pt-8 border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="btn btn-secondary"
                >
                  修正する
                </button>
                <div className="flex flex-row items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-circle"
                  >
                    <FaCopy />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSecondSubmit}
                  className="btn btn-primary disabled:btn-disabled"
                  disabled={!isSecondSubmitButtonOpen}
                >
                  投稿する
                </button>
              </div>
            </Modal>
          </div>
        </Form>
        </FormProvider>
      </div>
    </>
  );
}

function TextTypeSwitcher() {
  const { register } = useFormContext();
  return (
    <div className="mb-4">
      <H3>投稿タイプを選択</H3>
      <p>投稿したい経験知の種類を選択してください。</p>
      <div className="flex mt-4 rounded-lg border w-full p-4 flex-col gap-y-2">
        <div className="flex items-center gap-y-2 gap-x-2">
          <input
            type="radio"
            id="misDeed"
            value="misDeed"
            {...register("postCategory")}
            className="radio radio-primary"
          />
          <label htmlFor="misDeed">結果悪：</label>
          <span className="text-sm">経験知のうち、やってはいけないこと</span>
        </div>
        <div className="flex items-center gap-y-2 gap-x-2">
          <input
            type="radio"
            id="goodDeed"
            value="goodDeed"
            {...register("postCategory")}
            className="radio radio-primary"
          />
          <label htmlFor="goodDeed">結果善：</label>
          <span className="text-sm">経験知のうち、やってよかったこと</span>
        </div>
        <div className="flex items-center gap-y-2 gap-x-2">
          <input
            type="radio"
            id="wanted"
            value="wanted"
            {...register("postCategory")}
            className="radio radio-primary"
          />
          <label htmlFor="wanted">知識募集：</label>
          <span className="text-sm">
            知りたいこと、わからないこと、悩んでいること
          </span>
        </div>
      </div>
    </div>
  );
}

function SituationInput() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext();
  const postCategory = useWatch({ control, name: "postCategory" });
  const placeholder =
    postCategory === "misDeed"
      ? [
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
      : postCategory === "goodDeed"
      ? [
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
        ]
      : postCategory === "wanted"
      ? [
          {
            key: "who",
            description: "その状況の「主役」は誰ですか？(Who)",
            placeholder: "筆者が",
            rows: 1,
          },
          {
            key: "when",
            description: "いつ起こったことですか？(When)",
            placeholder: "社会人なりたての現在、初対面の人にあいさつするとき",
            rows: 1,
          },
          {
            key: "where",
            description: "どこで起こったことですか？(Where)",
            placeholder: "職場で",
            rows: 1,
          },
          {
            key: "why",
            description: "なぜそのような行動をしたのですか？(Why)",
            placeholder: "何を話せば良いのかわからないため",
            rows: 2,
          },
          {
            key: "what",
            description: "その主役は、何に対してはたらきかけましたか？(What)",
            placeholder: "相手に対して",
            rows: 1,
          },
          {
            key: "how",
            description: "その主役は、対象をどうしましたか？(How)",
            placeholder: "いつもそっけなく、名前と所属だけ話している",
            rows: 1,
          },
          {
            key: "then",
            description: "行動の結果としてどうなりましたか？(Then)",
            placeholder:
              "職場の人と仲良くなるきっかけがつかめず、孤独をもたらす一因となった",
            rows: 3,
          },
        ]
      : [];

  return (
    <div className="mb-8">
      <H3>5W1H+Then状況説明</H3>
      {placeholder.map((data, index) => {
        return (
          <div key={data.key} className="mb-4">
            <label htmlFor={data.key} className="block font-bold mb-2">
              {data.description}
            </label>
            <textarea
              id={data.key}
              placeholder={data.placeholder}
              rows={data.rows}
              className="w-full px-3 py-2 text-base-content border rounded-lg focus:outline-none placeholder-slate-500"
              {...register(`situations.${data.key}`)}
            />
            <div>
              {/* @ts-ignore */}
              {errors.situations?.[data.key] && (
                <ErrorMessageContainer
                  errormessage={
                    // @ts-ignore
                    errors.situations?.[data.key]?.message as string
                  }
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DynamicTextInput({
  description,
  registerKey = "situations.assumption",
}: {
  description: string;
  registerKey?: string;
}) {
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
            <textarea
              key={field.id}
              {...register(`${registerKey}.${index}`)}
              className="w-3/4 border rounded-lg placeholder-slate-500 px-3 py-2"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="bg-error text-error-content rounded-lg px-3 mx-3"
            >
              削除
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => append("")}
        className="bg-info text-info-content px-3 py-2 rounded-lg"
      >
        追加
      </button>
    </div>
  );
}

function StaticTextInput({
  rowNumber,
  title,
  placeholders,
  description,
  registerKey,
}: {
  rowNumber: number;
  title: string;
  placeholders: string[];
  description: string;
  registerKey: string;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const renderTextInputs = () => {
    const inputs = [];
    for (let i = 0; i < rowNumber; i++) {
      inputs.push(
        <div className="w-full" key={`${title}-input-${i}`}>
          <textarea
            key={`${title}-input-${i}`}
            className="flex-grow px-3 py-2 border rounded-lg focus:outline-none w-full my-2 placeholder-slate-500"
            placeholder={placeholders[i]}
            {...register(`${registerKey}.${i}`)}
          />
          {errors[registerKey] && (
            <ErrorMessageContainer
              errormessage={errors[registerKey]?.root?.message as string}
            />
          )}
        </div>
      );
    }
    return inputs;
  };
  return (
    <div className="mb-8">
      <H3>{title}</H3>
      <p>{description}</p>
      <div className="flex items-center space-x-2 mb-4 flex-col">
        {renderTextInputs()}
      </div>
    </div>
  );
}

function ErrorMessageContainer({ errormessage }: { errormessage: string }) {
  return (
    <div>
      <p className="text-error">[!] {errormessage}</p>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const turnstileToken = formData.get("token");

  if (actionType === "validateTurnstile") {
    console.log("validateTurnstile has been called"); 
    const ipAddress = await getHashedUserIPAddress(request);
    const isValidatedByTurnstile = await validateRequest(
      turnstileToken as string,
      ipAddress
    );
    console.log("isValidatedByTurnstile", isValidatedByTurnstile);
    if (!isValidatedByTurnstile) {
      return data({ success: false, error: "リクエストの検証に失敗しました。再度お試しください。" }, { status: 400 });
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.set("isValidUser", true);
    return data(
      {
        success: true,
      },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  }

  const postData = Object.fromEntries(formData);
  const stopWords = await getStopWords();
  const postFormSchema = createPostFormSchema(stopWords);
  type Inputs = z.infer<typeof postFormSchema>;

  const parsedData = {
    ...postData,
    postCategory: JSON.parse(postData.postCategory as string),
    situations: JSON.parse(postData.situations as string),
    reflection: JSON.parse(postData.reflection as string),
    counterReflection: JSON.parse(postData.counterReflection as string),
    note: JSON.parse(postData.note as string),
    selectedTags: JSON.parse((postData.selectedTags as string) || "[]"),
    createdTags: JSON.parse((postData.createdTags as string) || "[]"),
    title: JSON.parse(postData.title as string),
  } as unknown as Inputs;
  const isValidUser = await isUserValid(request); 
  if (!isValidUser) {
    return data({ success: false, error: "リクエスト検証に失敗しました。時間をおいて再度お試しください。" }, { status: 400 });
  }

  if (actionType === "firstSubmit") {
    try {
      const html = await Wikify(parsedData, postFormSchema);
      return data({
        success: true,
        data: { ...html.data, title: parsedData.title[0], tags: [...(parsedData.createdTags || []), ...(parsedData.selectedTags || [])] },
        error: undefined,
      });
    } catch (error) {
      return data({
        success: false,
        data: undefined,
        error: "Wikify failed",
      });
    }
  }

  if (actionType === "secondSubmit") {
    const html = await Wikify(parsedData, postFormSchema);
    const isSuccess = html.data.success;
    const wikifyResult = html.data?.data?.WikifiedResult;
    const postTitle = parsedData.title[0];
    const createdTags = parsedData.createdTags;
    const selectedTags = parsedData.selectedTags;
    if (!wikifyResult) {
      return data({ success: false, error: "Wikify failed", data: undefined });
    }

    if (isSuccess) {
      const hashedUserIpAddress = await getHashedUserIPAddress(request);
      if (html.data === undefined) {
        return data({
          success: false,
          error: "Wikify failed",
          data: undefined,
        }, { status: 400 });
      }
      const newPost = await prisma.$transaction(async (prisma) => {
        const newPost = await prisma.dimPosts.create({
          data: {
            postAuthorIPHash: hashedUserIpAddress,
            postContent: wikifyResult,
            postTitle: postTitle,
            countLikes: 0,
            countDislikes: 0,
            commentStatus: "open",
          },
        });
        const uniqueTags = [
          ...new Set([...(selectedTags || []), ...(createdTags || [])]),
        ];
        const existingTags = await prisma.dimTags.findMany({
          where: {
            tagName: {
              in: uniqueTags,
            },
          },
        });
        const existingTagNames = existingTags.map((tag) => tag.tagName);
        const newTagNames = uniqueTags.filter(
          (tag) => !existingTagNames.includes(tag)
        );
        const newTags = await Promise.all(
          newTagNames.map(async (tagName) => {
            return await prisma.dimTags.create({ data: { tagName } });
          })
        );
        const allTags = [...existingTags, ...newTags];
        await Promise.all(
          allTags.map(async (tag) => {
            return await prisma.relPostTags.create({
              data: { postId: newPost.postId, tagId: tag.tagId },
            });
          })
        );
        return newPost;
      });

      await createEmbedding({
        postId: Number(newPost.postId),
        postContent: newPost.postContent,
        postTitle: newPost.postTitle,
      });

      const { isWelcomed, explanation } = await getJudgeWelcomedByGenerativeAI(
        wikifyResult,
        postTitle
      );
      await updatePostWelcomed(Number(newPost.postId), isWelcomed, explanation);

      return data({
        success: true,
        error: undefined,
        data: { postId: newPost.postId },
      });
    }

    return data({ success: false, error: "Wikify failed", data: undefined }, { status: 400 });
  }
}

async function Wikify(
  postData: z.infer<ReturnType<typeof createPostFormSchema>>,
  postFormSchema: ReturnType<typeof createPostFormSchema>
) {
  // バリデーションを実施
  const validationResult = postFormSchema.safeParse(postData);
  if (!validationResult.success) {
    return data({
      success: false,
      error: validationResult.error.errors,
      data: undefined,
    }, { status: 400 });
  }

  const { who, when, where, why, what, how, then, assumption } =
    validationResult.data.situations;
  const { reflection, counterReflection } = validationResult.data;
  const { note, postCategory } = validationResult.data;

  function removeEmptyString(array: string[] | undefined): string[] {
    if (!array) return [];
    return array.filter((value) => !/^\s*$/.test(value));
  }

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
          .join("\n")}
      </ul>
      `
        : ""
    }
    <h3>
      ${
        postCategory === "misDeed"
          ? "健常行動ブレイクポイント"
          : postCategory === "goodDeed"
          ? "なぜやってよかったのか"
          : postCategory === "wanted"
          ? "試したこと"
          : ""
      }
    </h3>
    <ul>
      ${removeEmptyString(reflection)
        ?.map((reflection) => `<li>${reflection}</li>`)
        .join("\n")}
    </ul>
    <h3>
      ${
        postCategory === "misDeed"
          ? "どうすればよかったか"
          : postCategory === "goodDeed"
          ? "やらなかったらどうなっていたか"
          : postCategory === "wanted"
          ? "まだやってないこと"
          : ""
      }
    </h3>
    <ul>
      ${removeEmptyString(counterReflection)
        ?.map((counterReflection) => `<li>${counterReflection}</li>`)
        .join("\n")}
    </ul>
    ${
      removeEmptyString(note)?.length > 0
        ? `
      <h3>備考</h3>
      <ul>
        ${removeEmptyString(note)
          ?.map((note) => `<li>${note}</li>`)
          .join("\n")}
      </ul>
    `
        : ""
    }
  `;
  const markdownContent = NodeHtmlMarkdown.translate(result);
  return data({
    success: true,
    error: undefined,
    data: { WikifiedResult: result, MarkdownResult: markdownContent },
  });
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: "投稿する",
    description: "テンプレートに沿って投稿する",
    url: "https://healthy-person-emulator.org/post",
    image: null,
  });
  return commonMeta;
};
