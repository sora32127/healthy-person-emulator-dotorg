import {
  type MetaFunction,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  useLoaderData,
  Form,
} from 'react-router';
import { getAuthenticatedUser } from '~/modules/auth.google.server';
import { getUserId, getApiKeyByUserId, createApiKey, regenerateApiKey } from '~/modules/db.server';
import { commonMetaFunction } from '~/utils/commonMetafunction';
import { H1 } from '~/components/Headings';
import { Key, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return redirect('/?referrer=fromApiSettings');
  }
  const userId = await getUserId(user.userUuid);
  const apiKeyData = await getApiKeyByUserId(userId);
  return { apiKey: apiKeyData?.apiKey ?? null, email: user.email };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return redirect('/');
  }
  const userId = await getUserId(user.userUuid);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    await createApiKey(userId);
  } else if (intent === 'regenerate') {
    await regenerateApiKey(userId);
  }

  return redirect('/settings/api');
}

export default function ApiSettingsPage() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl mx-auto">
      <H1>API設定</H1>

      <div className="card bg-base-200 mt-6">
        <div className="card-body">
          <h2 className="card-title">
            <Key className="w-5 h-5" />
            APIキー
          </h2>

          {apiKey ? (
            <ApiKeyDisplay apiKey={apiKey} />
          ) : (
            <div>
              <p className="text-base-content/70 mb-4">
                APIキーを生成すると、プログラムから投稿データにアクセスできます。
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="create" />
                <button type="submit" className="btn btn-primary">
                  <Key className="w-4 h-4" />
                  APIキーを生成
                </button>
              </Form>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 mt-6">
        <div className="card-body">
          <h2 className="card-title">使い方</h2>
          <div className="space-y-3 text-sm">
            <p>
              すべてのリクエストに{' '}
              <code className="badge badge-ghost">Authorization: Bearer YOUR_API_KEY</code>{' '}
              ヘッダーを付けてください。
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>エンドポイント</th>
                    <th>説明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>GET /api/v1/posts</code>
                    </td>
                    <td>投稿一覧</td>
                  </tr>
                  <tr>
                    <td>
                      <code>GET /api/v1/posts/:id</code>
                    </td>
                    <td>投稿詳細</td>
                  </tr>
                  <tr>
                    <td>
                      <code>GET /api/v1/search?q=...</code>
                    </td>
                    <td>全文検索</td>
                  </tr>
                  <tr>
                    <td>
                      <code>GET /api/v1/tags</code>
                    </td>
                    <td>タグ一覧</td>
                  </tr>
                  <tr>
                    <td>
                      <code>GET /api/v1/tags/:name/posts</code>
                    </td>
                    <td>タグ別投稿</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const maskedKey = `${apiKey.slice(0, 8)}${'•'.repeat(20)}${apiKey.slice(-4)}`;

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <code className="flex-1 p-3 bg-base-300 rounded-lg font-mono text-sm break-all">
          {maskedKey}
        </code>
        <button
          type="button"
          className={`btn btn-square btn-sm ${copied ? 'btn-success' : 'btn-ghost'}`}
          onClick={handleCopy}
          title="コピー"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      {copied && <p className="text-sm text-success">コピーしました</p>}

      <div>
        <button
          type="button"
          className="btn btn-warning btn-sm"
          onClick={() => setShowConfirm(true)}
        >
          <RefreshCw className="w-4 h-4" />
          再生成
        </button>
      </div>

      {showConfirm && (
        <div className="alert alert-warning">
          <div>
            <p className="font-bold">APIキーを再生成しますか？</p>
            <p className="text-sm">現在のキーは無効になります。この操作は取り消せません。</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowConfirm(false)}
            >
              キャンセル
            </button>
            <Form method="post">
              <input type="hidden" name="intent" value="regenerate" />
              <button type="submit" className="btn btn-sm btn-warning">
                再生成する
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: 'Loading...' }];
  }
  return commonMetaFunction({
    title: 'API設定',
    description: 'APIキーの管理',
    image: null,
    url: 'https://healthy-person-emulator.org/settings/api',
  });
};
