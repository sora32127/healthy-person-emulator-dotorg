/**
 * 健常者エミュレータ事例集 公開API の OpenAPI 3.1.0 仕様。
 * `/api/openapi.json` および `/api-docs` の単一情報源。
 */

const BASE_URL = 'https://healthy-person-emulator.org';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: '健常者エミュレータ事例集 公開API',
    version: '1.0.0',
    description:
      'AIエージェント・外部クライアント向けに、健常者エミュレータ事例集の投稿を検索・取得するためのJSON API。認証不要・CORS対応。',
    contact: {
      name: '管理人',
      url: 'https://x.com/messages/compose?recipient_id=1249916069344473088',
    },
    license: {
      name: 'GPL-3.0',
      url: 'https://www.gnu.org/licenses/gpl-3.0.html',
    },
  },
  servers: [
    {
      url: BASE_URL,
      description: '本番環境',
    },
  ],
  tags: [
    { name: 'search', description: '投稿検索' },
    { name: 'posts', description: '投稿本文取得' },
  ],
  paths: {
    '/api/search': {
      get: {
        operationId: 'searchPosts',
        tags: ['search'],
        summary: '投稿を検索する',
        description:
          'キーワード・タグで投稿一覧（タイトル・メタデータ）を取得する。本文を取得するには、結果中の `postId` を `GET /api/posts/{postId}` に渡す。',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            description: '検索キーワード（記事タイトル・本文を部分一致検索）',
            schema: { type: 'string', default: '' },
            example: '挨拶',
          },
          {
            name: 'tags',
            in: 'query',
            required: false,
            description: 'タグ名をスペース区切りで指定。複数指定時はAND条件で絞り込まれる。',
            schema: { type: 'string', default: '' },
            example: 'コミュニケーション 対人関係',
          },
          {
            name: 'orderby',
            in: 'query',
            required: false,
            description: '並び順',
            schema: {
              type: 'string',
              enum: ['timeDesc', 'timeAsc', 'like'],
              default: 'timeDesc',
            },
            example: 'like',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'ページ番号（1始まり）',
            schema: { type: 'integer', minimum: 1, default: 1 },
            example: 1,
          },
          {
            name: 'pageSize',
            in: 'query',
            required: false,
            description: '1ページあたりの件数。50を超える指定は50にクランプされる。',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            example: 10,
          },
        ],
        responses: {
          '200': {
            description: '検索成功',
            headers: {
              'Cache-Control': {
                description: 'ブラウザ60秒・CDN300秒のpublic cache',
                schema: { type: 'string' },
                example: 'public, max-age=60, s-maxage=300',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResult' },
                examples: {
                  keywordSearch: {
                    summary: 'キーワード検索',
                    value: {
                      metadata: {
                        query: '挨拶',
                        count: 90,
                        page: 1,
                        totalPages: 9,
                        orderby: 'timeDesc',
                        hasMore: true,
                      },
                      tagCounts: [
                        { tagName: 'コミュニケーション', count: 26 },
                        { tagName: '対人関係', count: 23 },
                      ],
                      results: [
                        {
                          postId: 32172,
                          postTitle: '付き合いたい異性には自然に交際相手がいないか聞いてみると良い',
                          postUrl: `${BASE_URL}/archives/32172`,
                          postDateGmt: '2023-04-10T11:38:49.000Z',
                          countLikes: 97,
                          countDislikes: 2,
                          countComments: 9,
                          tagNames: ['恋愛', '対人関係', '人間関係'],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/posts/{postId}': {
      get: {
        operationId: 'getPostById',
        tags: ['posts'],
        summary: '投稿の本文・コメント・タグ等を取得する',
        description:
          '個別投稿の本文（HTML）・コメント一覧・タグ・類似投稿・前後の投稿等を取得する。',
        parameters: [
          {
            name: 'postId',
            in: 'path',
            required: true,
            description: '投稿ID。正の整数。',
            schema: { type: 'integer', minimum: 1 },
            example: 32172,
          },
        ],
        responses: {
          '200': {
            description: '取得成功',
            headers: {
              'Cache-Control': {
                description: 'ブラウザ60秒・CDN300秒のpublic cache',
                schema: { type: 'string' },
                example: 'public, max-age=60, s-maxage=300',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Post' },
              },
            },
          },
          '400': {
            description: '不正な `postId`（非整数・0以下など）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'postId must be a positive integer' },
              },
            },
          },
          '404': {
            description: '該当する投稿が存在しない',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Post not found' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SearchResult: {
        type: 'object',
        required: ['metadata', 'tagCounts', 'results'],
        properties: {
          metadata: { $ref: '#/components/schemas/SearchMetadata' },
          tagCounts: {
            type: 'array',
            description: '検索結果に含まれるタグごとの件数（タグ絞り込みの参考用）',
            items: { $ref: '#/components/schemas/TagCount' },
          },
          results: {
            type: 'array',
            description: '投稿の配列',
            items: { $ref: '#/components/schemas/SearchHit' },
          },
        },
      },
      SearchMetadata: {
        type: 'object',
        required: ['query', 'count', 'page', 'totalPages', 'orderby', 'hasMore'],
        properties: {
          query: { type: 'string', description: 'リクエストで指定された `q` の値' },
          count: { type: 'integer', description: '総ヒット件数' },
          page: { type: 'integer', description: '現在のページ番号（1始まり）' },
          totalPages: { type: 'integer', description: '総ページ数' },
          orderby: {
            type: 'string',
            enum: ['timeDesc', 'timeAsc', 'like'],
            description: '適用された並び順',
          },
          hasMore: {
            type: 'boolean',
            description: '次ページが存在するか',
          },
        },
      },
      TagCount: {
        type: 'object',
        required: ['tagName', 'count'],
        properties: {
          tagName: { type: 'string' },
          count: { type: 'integer' },
        },
      },
      SearchHit: {
        type: 'object',
        required: [
          'postId',
          'postTitle',
          'postUrl',
          'postDateGmt',
          'countLikes',
          'countDislikes',
          'countComments',
          'tagNames',
        ],
        properties: {
          postId: { type: 'integer', description: '投稿ID（本文取得APIに渡す値）' },
          postTitle: { type: 'string', description: 'タイトル' },
          postUrl: {
            type: 'string',
            format: 'uri',
            description: '投稿の絶対URL',
          },
          postDateGmt: {
            type: 'string',
            format: 'date-time',
            description: '投稿日時（ISO 8601, UTC）',
          },
          countLikes: { type: 'integer' },
          countDislikes: { type: 'integer' },
          countComments: { type: 'integer' },
          tagNames: {
            type: 'array',
            items: { type: 'string' },
            description: '紐づくタグ名',
          },
        },
      },
      Post: {
        type: 'object',
        required: [
          'postId',
          'postTitle',
          'postUrl',
          'postDateGmt',
          'postContentHtml',
          'commentStatus',
          'countLikes',
          'countDislikes',
          'countBookmarks',
          'countComments',
          'ogpImageUrl',
          'isWelcomed',
          'isWelcomedExplanation',
          'tags',
          'comments',
          'similarPosts',
          'previousPost',
          'nextPost',
        ],
        properties: {
          postId: { type: 'integer' },
          postTitle: { type: 'string' },
          postUrl: { type: 'string', format: 'uri' },
          postDateGmt: { type: 'string', format: 'date-time' },
          postContentHtml: {
            type: 'string',
            description: '投稿本文（HTML形式。サイト上の表示と同じマークアップ）',
          },
          commentStatus: {
            type: 'string',
            description: 'コメント受付状態（例: `open`, `closed`）',
          },
          countLikes: { type: 'integer' },
          countDislikes: { type: 'integer' },
          countBookmarks: { type: 'integer' },
          countComments: { type: 'integer' },
          ogpImageUrl: {
            type: ['string', 'null'],
            format: 'uri',
            description: 'OGP画像のURL。未生成の場合は `null`',
          },
          isWelcomed: {
            type: ['boolean', 'null'],
            description: 'AIによるコンテンツフィルターの結果',
          },
          isWelcomedExplanation: {
            type: ['string', 'null'],
            description: 'AIによるコンテンツフィルターの判定理由',
          },
          tags: {
            type: 'array',
            items: { $ref: '#/components/schemas/Tag' },
          },
          comments: {
            type: 'array',
            items: { $ref: '#/components/schemas/Comment' },
          },
          similarPosts: {
            type: 'array',
            description: '類似した投稿',
            items: { $ref: '#/components/schemas/PostSummary' },
          },
          previousPost: {
            oneOf: [{ $ref: '#/components/schemas/PostSummary' }, { type: 'null' }],
            description: '前の投稿。先頭の投稿の場合は `null`',
          },
          nextPost: {
            oneOf: [{ $ref: '#/components/schemas/PostSummary' }, { type: 'null' }],
            description: '次の投稿。末尾の投稿の場合は `null`',
          },
        },
      },
      Tag: {
        type: 'object',
        required: ['tagName', 'tagId'],
        properties: {
          tagName: { type: 'string' },
          tagId: { type: 'integer' },
        },
      },
      Comment: {
        type: 'object',
        required: [
          'commentId',
          'commentDateGmt',
          'commentAuthor',
          'commentContent',
          'likesCount',
          'dislikesCount',
          'commentParent',
        ],
        properties: {
          commentId: { type: 'integer' },
          commentDateGmt: { type: 'string', format: 'date-time' },
          commentAuthor: { type: 'string' },
          commentContent: { type: 'string' },
          likesCount: { type: 'integer' },
          dislikesCount: { type: 'integer' },
          commentParent: {
            type: 'integer',
            description: '親コメントID。トップレベルコメントは `0`',
          },
        },
      },
      PostSummary: {
        type: 'object',
        required: ['postId', 'postTitle', 'postUrl'],
        properties: {
          postId: { type: 'integer' },
          postTitle: { type: 'string' },
          postUrl: { type: 'string', format: 'uri' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'エラーメッセージ' },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
