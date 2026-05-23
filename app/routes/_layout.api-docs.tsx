/**
 * 公開API仕様ページ（OpenAPI 3.1.0 ベース）。
 * 機械可読版は `/api/openapi.json` で取得可能。
 */
import type { MetaFunction } from 'react-router';
import { NavLink } from 'react-router';
import { H1, H2, H3, H4 } from '~/components/Headings';
import { commonMetaFunction } from '~/utils/commonMetafunction';
import { openApiSpec } from '~/modules/openapi-spec';

const BASE_URL = 'https://healthy-person-emulator.org';

function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PUT' | 'DELETE' }) {
  const colors: Record<typeof method, string> = {
    GET: 'bg-green-800',
    POST: 'bg-blue-800',
    PUT: 'bg-amber-800',
    DELETE: 'bg-red-800',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold text-white rounded ${colors[method]}`}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: '2xx' | '4xx' | '5xx' }) {
  const colors: Record<typeof status, string> = {
    '2xx': 'bg-green-800',
    '4xx': 'bg-amber-800',
    '5xx': 'bg-red-800',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold text-white rounded ${colors[status]}`}
    >
      {status}
    </span>
  );
}

function ParamTable({
  rows,
}: {
  rows: Array<{
    name: string;
    location: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    constraint?: string;
    description: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th>名前</th>
            <th>位置</th>
            <th>型</th>
            <th>必須</th>
            <th>制約 / デフォルト</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>{r.location}</td>
              <td>
                <code>{r.type}</code>
              </td>
              <td>{r.required ? '必須' : '任意'}</td>
              <td className="text-xs">
                {r.constraint && <div>{r.constraint}</div>}
                {r.defaultValue !== undefined && (
                  <div>
                    デフォルト: <code>{r.defaultValue}</code>
                  </div>
                )}
              </td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaTable({
  rows,
}: {
  rows: Array<{
    field: string;
    type: string;
    nullable?: boolean;
    description: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th>フィールド</th>
            <th>型</th>
            <th>nullable</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field}>
              <td>
                <code>{r.field}</code>
              </td>
              <td>
                <code>{r.type}</code>
              </td>
              <td>{r.nullable ? '✓' : ''}</td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-base-300 text-base-content p-4 rounded my-4 overflow-x-auto text-xs">
      <code>{children}</code>
    </pre>
  );
}

export default function Component() {
  const spec = openApiSpec;
  return (
    <div className="postContent">
      <H1>公開API仕様</H1>

      <p>
        健常者エミュレータ事例集の投稿を、AIエージェント・外部クライアントから検索・取得するための公開API仕様です。
        OpenAPI 3.1.0 準拠の機械可読版は{' '}
        <a href="/api/openapi.json">
          <code>/api/openapi.json</code>
        </a>{' '}
        から取得できます。
      </p>

      <H2>概要</H2>
      <ul>
        <li>
          <strong>バージョン:</strong> <code>{spec.info.version}</code>
        </li>
        <li>
          <strong>ベースURL:</strong> <code>{BASE_URL}</code>
        </li>
        <li>
          <strong>認証:</strong> 不要（全エンドポイント公開）
        </li>
        <li>
          <strong>CORS:</strong> <code>Access-Control-Allow-Origin: *</code>
        </li>
        <li>
          <strong>レスポンス形式:</strong> <code>application/json; charset=utf-8</code>
        </li>
        <li>
          <strong>キャッシュ:</strong> <code>Cache-Control: public, max-age=60, s-maxage=300</code>
        </li>
        <li>
          <strong>ライセンス:</strong> 投稿データは
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          （Wikipediaと同じライセンス）。利用時は <code>healthy-person-emulator.org</code>{' '}
          を出典として明示してください。
        </li>
      </ul>

      <H3>レート制限</H3>
      <p>
        明示的なレート制限はありませんが、Cloudflareにより異常なリクエストパターンは制限される可能性があります。
        AIエージェントから大量に取得する場合は、<code>postId</code>{' '}
        ごとに数十ミリ秒の間隔を空けるなど、節度を持って利用してください。
      </p>

      <H3>共通エラーレスポンス</H3>
      <p>4xx系のエラーは全て以下の形式のJSONで返却されます。</p>
      <SchemaTable rows={[{ field: 'error', type: 'string', description: 'エラーメッセージ' }]} />

      <H2>エンドポイント一覧</H2>
      <ul>
        <li>
          <a href="#endpoint-search">
            <MethodBadge method="GET" /> <code>/api/search</code> — 投稿を検索する
          </a>
        </li>
        <li>
          <a href="#endpoint-post">
            <MethodBadge method="GET" /> <code>/api/posts/{'{postId}'}</code> —
            投稿の本文・コメント・タグ等を取得する
          </a>
        </li>
        <li>
          <a href="#endpoint-openapi">
            <MethodBadge method="GET" /> <code>/api/openapi.json</code> — OpenAPI 3.1.0 仕様
          </a>
        </li>
      </ul>

      <div id="endpoint-search">
        <H2>
          <MethodBadge method="GET" /> /api/search
        </H2>
        <p>キーワード・タグで投稿一覧（タイトル・メタデータ）を取得します。</p>
        <p>
          本文を取得するには、結果中の <code>postId</code> を{' '}
          <a href="#endpoint-post">
            <code>GET /api/posts/{'{postId}'}</code>
          </a>{' '}
          に渡してください。
        </p>

        <H3>リクエスト</H3>
        <H4>クエリパラメータ</H4>
        <ParamTable
          rows={[
            {
              name: 'q',
              location: 'query',
              type: 'string',
              required: false,
              defaultValue: '""',
              description: '検索キーワード。記事タイトル・本文を部分一致検索する。',
            },
            {
              name: 'tags',
              location: 'query',
              type: 'string',
              required: false,
              defaultValue: '""',
              description: 'タグ名をスペース区切りで指定。複数指定時はAND条件で絞り込まれる。',
            },
            {
              name: 'orderby',
              location: 'query',
              type: 'string',
              required: false,
              defaultValue: 'timeDesc',
              constraint: 'enum: timeDesc / timeAsc / like',
              description: '並び順。不正な値はデフォルトにフォールバック。',
            },
            {
              name: 'page',
              location: 'query',
              type: 'integer',
              required: false,
              defaultValue: '1',
              constraint: '最小: 1',
              description: 'ページ番号（1始まり）。',
            },
            {
              name: 'pageSize',
              location: 'query',
              type: 'integer',
              required: false,
              defaultValue: '10',
              constraint: '最小: 1 / 最大: 50',
              description: '1ページあたりの件数。50を超える指定は50にクランプ。',
            },
          ]}
        />

        <H4>リクエスト例</H4>
        <CodeBlock>{`# キーワード検索
curl "${BASE_URL}/api/search?q=挨拶&pageSize=5"

# タグ絞り込み＋いいね順
curl "${BASE_URL}/api/search?tags=コミュニケーション&orderby=like"

# ページング
curl "${BASE_URL}/api/search?q=会話&page=2&pageSize=20"`}</CodeBlock>

        <H3>レスポンス</H3>
        <H4>
          <StatusBadge status="2xx" /> 200 OK
        </H4>
        <p>
          <code>SearchResult</code> オブジェクト。
        </p>
        <SchemaTable
          rows={[
            {
              field: 'metadata',
              type: 'SearchMetadata',
              description: 'リクエスト条件のエコーバック・件数・ページング情報',
            },
            {
              field: 'tagCounts',
              type: 'TagCount[]',
              description:
                '検索結果（フィルタなし版）に含まれるタグごとの件数。タグ絞り込みの参考用',
            },
            {
              field: 'results',
              type: 'SearchHit[]',
              description: '投稿の配列',
            },
          ]}
        />

        <H4>レスポンス例</H4>
        <CodeBlock>{`{
  "metadata": {
    "query": "挨拶",
    "count": 90,
    "page": 1,
    "totalPages": 9,
    "orderby": "timeDesc",
    "hasMore": true
  },
  "tagCounts": [
    { "tagName": "コミュニケーション", "count": 26 },
    { "tagName": "対人関係", "count": 23 }
  ],
  "results": [
    {
      "postId": 32172,
      "postTitle": "付き合いたい異性には自然に交際相手がいないか聞いてみると良い",
      "postUrl": "${BASE_URL}/archives/32172",
      "postDateGmt": "2023-04-10T11:38:49.000Z",
      "countLikes": 97,
      "countDislikes": 2,
      "countComments": 9,
      "tagNames": ["恋愛", "対人関係", "人間関係"]
    }
  ]
}`}</CodeBlock>
      </div>

      <div id="endpoint-post">
        <H2>
          <MethodBadge method="GET" /> /api/posts/{'{postId}'}
        </H2>
        <p>個別投稿の本文（HTML）・コメント一覧・タグ・類似投稿・前後の投稿を取得します。</p>

        <H3>リクエスト</H3>
        <H4>パスパラメータ</H4>
        <ParamTable
          rows={[
            {
              name: 'postId',
              location: 'path',
              type: 'integer',
              required: true,
              constraint: '最小: 1',
              description: '投稿ID。正の整数。',
            },
          ]}
        />

        <H4>リクエスト例</H4>
        <CodeBlock>{`curl "${BASE_URL}/api/posts/32172"`}</CodeBlock>

        <H3>レスポンス</H3>
        <H4>
          <StatusBadge status="2xx" /> 200 OK
        </H4>
        <p>
          <code>Post</code> オブジェクト。
        </p>
        <SchemaTable
          rows={[
            { field: 'postId', type: 'integer', description: '投稿ID' },
            { field: 'postTitle', type: 'string', description: 'タイトル' },
            { field: 'postUrl', type: 'string (uri)', description: '投稿の絶対URL' },
            {
              field: 'postDateGmt',
              type: 'string (date-time)',
              description: '投稿日時（ISO 8601, UTC）',
            },
            {
              field: 'postContentHtml',
              type: 'string',
              description: '投稿本文（HTML形式。サイト上の表示と同じマークアップ）',
            },
            {
              field: 'commentStatus',
              type: 'string',
              description: 'コメント受付状態（例: open, closed）',
            },
            { field: 'countLikes', type: 'integer', description: 'いいね数' },
            { field: 'countDislikes', type: 'integer', description: '低評価数' },
            { field: 'countBookmarks', type: 'integer', description: 'ブックマーク数' },
            { field: 'countComments', type: 'integer', description: 'コメント数' },
            {
              field: 'ogpImageUrl',
              type: 'string (uri)',
              nullable: true,
              description: 'OGP画像のURL。未生成の場合は null',
            },
            {
              field: 'isWelcomed',
              type: 'boolean',
              nullable: true,
              description: 'AIによるコンテンツフィルターの結果',
            },
            {
              field: 'isWelcomedExplanation',
              type: 'string',
              nullable: true,
              description: 'AIによるコンテンツフィルターの判定理由',
            },
            { field: 'tags', type: 'Tag[]', description: '紐づくタグ' },
            { field: 'comments', type: 'Comment[]', description: 'コメント一覧' },
            {
              field: 'similarPosts',
              type: 'PostSummary[]',
              description: '類似した投稿',
            },
            {
              field: 'previousPost',
              type: 'PostSummary',
              nullable: true,
              description: '前の投稿。先頭なら null',
            },
            {
              field: 'nextPost',
              type: 'PostSummary',
              nullable: true,
              description: '次の投稿。末尾なら null',
            },
          ]}
        />

        <H4>
          <StatusBadge status="4xx" /> 400 Bad Request
        </H4>
        <p>
          <code>postId</code> が正の整数でない場合（非数値・0以下など）。
        </p>
        <CodeBlock>{`{ "error": "postId must be a positive integer" }`}</CodeBlock>

        <H4>
          <StatusBadge status="4xx" /> 404 Not Found
        </H4>
        <p>
          該当する <code>postId</code> の投稿が存在しない場合。
        </p>
        <CodeBlock>{`{ "error": "Post not found" }`}</CodeBlock>
      </div>

      <div id="endpoint-openapi">
        <H2>
          <MethodBadge method="GET" /> /api/openapi.json
        </H2>
        <p>
          本APIのOpenAPI 3.1.0 仕様を機械可読なJSONで返します。
          コード生成ツール（openapi-generator、orval等）やAIエージェントから直接読み込めます。
        </p>
        <CodeBlock>{`curl "${BASE_URL}/api/openapi.json"`}</CodeBlock>
      </div>

      <H2 id="schemas">スキーマ定義</H2>
      <p>各エンドポイントで再利用される型の定義です。</p>

      <H3>SearchMetadata</H3>
      <SchemaTable
        rows={[
          { field: 'query', type: 'string', description: 'リクエストの q の値' },
          { field: 'count', type: 'integer', description: '総ヒット件数' },
          { field: 'page', type: 'integer', description: '現在のページ番号（1始まり）' },
          { field: 'totalPages', type: 'integer', description: '総ページ数' },
          {
            field: 'orderby',
            type: 'enum (timeDesc / timeAsc / like)',
            description: '適用された並び順',
          },
          { field: 'hasMore', type: 'boolean', description: '次ページが存在するか' },
        ]}
      />

      <H3>TagCount</H3>
      <SchemaTable
        rows={[
          { field: 'tagName', type: 'string', description: 'タグ名' },
          { field: 'count', type: 'integer', description: '件数' },
        ]}
      />

      <H3>SearchHit</H3>
      <SchemaTable
        rows={[
          { field: 'postId', type: 'integer', description: '投稿ID' },
          { field: 'postTitle', type: 'string', description: 'タイトル' },
          { field: 'postUrl', type: 'string (uri)', description: '投稿の絶対URL' },
          {
            field: 'postDateGmt',
            type: 'string (date-time)',
            description: '投稿日時（ISO 8601, UTC）',
          },
          { field: 'countLikes', type: 'integer', description: 'いいね数' },
          { field: 'countDislikes', type: 'integer', description: '低評価数' },
          { field: 'countComments', type: 'integer', description: 'コメント数' },
          { field: 'tagNames', type: 'string[]', description: '紐づくタグ名' },
        ]}
      />

      <H3>Tag</H3>
      <SchemaTable
        rows={[
          { field: 'tagName', type: 'string', description: 'タグ名' },
          { field: 'tagId', type: 'integer', description: 'タグID' },
        ]}
      />

      <H3>Comment</H3>
      <SchemaTable
        rows={[
          { field: 'commentId', type: 'integer', description: 'コメントID' },
          {
            field: 'commentDateGmt',
            type: 'string (date-time)',
            description: 'コメント投稿日時（ISO 8601, UTC）',
          },
          { field: 'commentAuthor', type: 'string', description: '投稿者名' },
          { field: 'commentContent', type: 'string', description: 'コメント本文' },
          { field: 'likesCount', type: 'integer', description: 'いいね数' },
          { field: 'dislikesCount', type: 'integer', description: '低評価数' },
          {
            field: 'commentParent',
            type: 'integer',
            description: '親コメントID（トップレベルは 0）',
          },
        ]}
      />

      <H3>PostSummary</H3>
      <SchemaTable
        rows={[
          { field: 'postId', type: 'integer', description: '投稿ID' },
          { field: 'postTitle', type: 'string', description: 'タイトル' },
          { field: 'postUrl', type: 'string (uri)', description: '投稿の絶対URL' },
        ]}
      />

      <H3>Error</H3>
      <SchemaTable rows={[{ field: 'error', type: 'string', description: 'エラーメッセージ' }]} />

      <H2>利用条件と問い合わせ</H2>
      <ul>
        <li>
          投稿データは <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>{' '}
          で公開されています（Wikipediaと同じライセンス）。人間・機械の両方が自由に利用できますが、出典として{' '}
          <code>healthy-person-emulator.org</code>{' '}
          を明示し、二次利用物にも同じライセンスを継承してください。
        </li>
        <li>
          バグ報告・要望は <a href="https://discord.com/invite/sQehNGTnSg">Discord</a>
          の「#エンジニアリング議論」チャンネル、または管理人の{' '}
          <a href="https://x.com/messages/compose?recipient_id=1249916069344473088">XのDM</a>
          まで。
        </li>
        <li>
          サイト全体の概要は<NavLink to="/readme">サイト説明</NavLink>を参照してください。
        </li>
      </ul>
    </div>
  );
}

export const meta: MetaFunction = () => {
  return commonMetaFunction({
    title: '公開API仕様',
    description: 'AIエージェント・外部クライアント向けの公開JSON API仕様（OpenAPI 3.1.0準拠）',
    url: `${BASE_URL}/api-docs`,
    image: null,
  });
};
