import {
  useForm,
  type SubmitHandler,
  FormProvider,
  useFormContext,
  useWatch,
  useFieldArray,
} from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  json,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
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
import { useSubmit } from "@remix-run/react";
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

export async function loader({ request }: LoaderFunctionArgs) {
  const tags = await getTagsCounts();
  const stopWords = await getStopWords();
  const isValid = await isUserValid(request);
  const turnStileSiteKey = await getTurnStileSiteKey();
  return json({ tags, stopWords, isValid, turnStileSiteKey });
}

export default function App() {
  const { tags, stopWords, isValid, turnStileSiteKey } = useLoaderData<typeof loader>();
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
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
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
          then: "",
        },
        reflection: [],
        counterReflection: [],
        note: [],
        selectedTags: [],
        createdTags: [],
      };
    const stored = window.localStorage.getItem(formId);
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
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

  const submit = useSubmit();
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const formData = new FormData();
    formData.append("_action", "firstSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
    submit(formData, {
      method: "post",
      action: "/post",
    });
  };

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
  const actionData = useActionData<typeof action>();

  const fetcher = useFetcher();
  const handleTurnStileSuccess = (token: string) => {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("_action", "validateTurnstile");
    fetcher.submit(formData, { method: "post", action: "/post" });
  };

  return (
    <>
      <div className="templateSubmitForm">
        <FormProvider {...methods}>
          <Form method="post" onSubmit={methods.handleSubmit(onSubmit)}>
            <UserExplanation />
            <br />
            <div className="flex justify-start mt-6">
              <ClearFormButton clearInputs={() => clearForm(methods.reset)} />
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
            <PreviewButton
              actionData={actionData}
              postFormSchema={postFormSchema}
              turnStileSiteKey={turnStileSiteKey}
              handleTurnStileSuccess={handleTurnStileSuccess}
            />
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
            rows: 1,
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
              {errors.situations?.[data.key] && (
                <ErrorMessageContainer
                  errormessage={
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
            <input
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
        <div className="w-full">
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

function clearForm(formClear: () => void) {
  formClear();
  window.localStorage.clear();
}

// useActionDataを丸ごと使う
function PreviewButton({
  actionData,
  postFormSchema,
  turnStileSiteKey,
  handleTurnStileSuccess,
}: {
  actionData: typeof action;
  postFormSchema: ReturnType<typeof createPostFormSchema>;
  turnStileSiteKey: string;
  handleTurnStileSuccess: (token: string) => void;
}) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const {
    getValues,
    trigger,
    reset,
    setValue,
    formState: { isSubmitSuccessful, isSubmitting },
  } = useFormContext();
  const [isFirstSubmitButtonDisabled, setIsFirstSubmitButtonDisabled] =
    useState(false);
  const [isSecondSubmitButtonDisabled, setIsSecondSubmitButtonDisabled] =
    useState(false);

  const submit = useSubmit();
  type Inputs = z.infer<typeof postFormSchema>;

  function MakeToastMessage(errors: z.ZodIssue[]): string {
    let errorMessage = "";
    if (errors.length > 0) {
      errorMessage = errors.map((error) => `- ${error.message}`).join("\n");
    }
    return errorMessage;
  }

  const toastNotify = (errorMessage: string) => toast.error(errorMessage);

  useEffect(() => {
    if (isSubmitSuccessful) {
      setIsFirstSubmitButtonDisabled(false);
    }
    if (isSubmitting) {
      setIsFirstSubmitButtonDisabled(true);
    }
  }, [isSubmitSuccessful, isSubmitting]);

  const handleFirstSubmit = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    setIsFirstSubmitButtonDisabled(true);
    setTimeout(() => {
      setIsFirstSubmitButtonDisabled(false);
    }, 3000);
    await trigger();
    const inputData = getValues();
    const zodErrors = postFormSchema.safeParse(inputData);
    if (!zodErrors.success) {
      const errorMessage = MakeToastMessage(zodErrors.error.issues);
      toastNotify(errorMessage);
      return;
    }

    const data = getValues() as Inputs;
    const formData = new FormData();
    formData.append("_action", "firstSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
    submit(formData, { method: "post", action: "/post" });
    setShowPreviewModal(true);
  };

  const navigate = useNavigate();

  const handleSecondSubmit = async () => {
    setIsSecondSubmitButtonDisabled(true);
    setTimeout(() => {
      setIsSecondSubmitButtonDisabled(false);
    }, 3000);
    const data = getValues() as Inputs;
    const formData = new FormData();
    formData.append("_action", "secondSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
    submit(formData, { method: "post", action: "/post" });
  };

  useEffect(() => {
    if (actionData?.success && actionData?.data?.postId) {
      toast.success("投稿が完了しました。リダイレクトします...");
      setTimeout(() => {
        navigate(`/archives/${actionData.data.postId}`);
        clearForm(reset);
      }, 2000);
    }
  }, [actionData, navigate, reset]);

  const handleCopy = async () => {
    if (actionData?.data?.MarkdownResult) {
      navigator.clipboard.writeText(actionData.data.MarkdownResult);
      toast.success("クリップボードにコピーしました");
    }
  };

  const postTitle = getValues("title")[0];
  return (
    <div className="flex justify-end">
      <div className="flex flex-col items-center gap-1 p-2">
        <Turnstile
          siteKey={turnStileSiteKey}
          onSuccess={handleTurnStileSuccess}
        />
        <button
          type="submit"
          onClick={handleFirstSubmit}
          className={`btn
            ${isFirstSubmitButtonDisabled ? "animate-pulse bg-base-300" : ""}
            ${!isFirstSubmitButtonDisabled ? "btn-primary" : ""}
          `}
          disabled={isFirstSubmitButtonDisabled}
        >
          投稿する
        </button>
      </div>
      <Toaster />
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="投稿内容を確認してください"
        showCloseButton={false}
      >
        <div className="postContent">
          <H1>{postTitle}</H1>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
          <div
            dangerouslySetInnerHTML={{
              __html: actionData?.data?.WikifiedResult ?? "",
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-6 border-t pt-8 border-gray-200">
          <button
            type="button"
            onClick={() => setShowPreviewModal(false)}
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
            className={`btn
                ${
                  isSecondSubmitButtonDisabled
                    ? "animate-pulse bg-base-300"
                    : ""
                }
                ${!isSecondSubmitButtonDisabled ? "btn-primary" : ""}
              `}
            disabled={isSecondSubmitButtonDisabled}
          >
            {isSubmitting ? "投稿中..." : "投稿する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const turnstileToken = formData.get("token");

  if (actionType === "validateTurnstile") {
    const ipAddress = await getHashedUserIPAddress(request);
    console.log("ipAddress", ipAddress);
    console.log("turnstileToken", turnstileToken);
    const isValidatedByTurnstile = await validateRequest(
      turnstileToken as string,
      ipAddress
    );
    if (!isValidatedByTurnstile) {
      return json({ success: false, error: "リクエストの検証に失敗しました。再度お試しください。" }, { status: 400 });
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.set("isValidUser", true);
    return json(
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
    return json({ success: false, error: "Needed for user validation" }, { status: 400 });
  }



  if (actionType === "firstSubmit") {
    try {
      const html = await Wikify(parsedData, postFormSchema);
      const data = await html.json();
      return json({
        success: true,
        data: data.data,
        error: undefined,
      });
    } catch (error) {
      return json({
        success: false,
        data: undefined,
        error: "Wikify failed",
      });
    }
  }

  if (actionType === "secondSubmit") {
    const html = await Wikify(parsedData, postFormSchema);
    const data = await html.json();
    const isSuccess = data.success;
    const wikifyResult = data.data?.WikifiedResult;
    const postTitle = parsedData.title[0];
    const createdTags = parsedData.createdTags;
    const selectedTags = parsedData.selectedTags;
    if (!wikifyResult) {
      return json({ success: false, error: "Wikify failed", data: undefined });
    }

    if (isSuccess) {
      const hashedUserIpAddress = await getHashedUserIPAddress(request);
      if (data.data === undefined) {
        return json({
          success: false,
          error: "Wikify failed",
          data: undefined,
        });
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

      return json({
        success: true,
        error: undefined,
        data: { postId: newPost.postId },
      });
    }

    return json({ success: false, error: data.error, data: undefined });
  }
}

async function Wikify(
  postData: z.infer<ReturnType<typeof createPostFormSchema>>,
  postFormSchema: ReturnType<typeof createPostFormSchema>
) {
  // バリデーションを実施
  const validationResult = postFormSchema.safeParse(postData);
  if (!validationResult.success) {
    return json({
      success: false,
      error: validationResult.error.errors,
      data: undefined,
    });
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
  return json({
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
