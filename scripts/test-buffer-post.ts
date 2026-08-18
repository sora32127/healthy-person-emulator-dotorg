/**
 * Buffer 経由 X 投稿の実テストランナー
 *
 * 実Xアカウントに Buffer 経由で実際に投稿するテストです。
 * 本番APIキーは「環境変数」で渡してください（ログ・ファイル・git に残さない）。
 *
 * 使い方:
 *   BUFFER_API_KEY=<APIキー> npx tsx scripts/test-buffer-post.ts \
 *     --title "最新記事タイトル" \
 *     --url "https://healthy-person-emulator.org/archives/<id>" \
 *     --image-url "https://static.healthy-person-emulator.org/ogp/<id>.png" \
 *     [--message-type new|legendary|random]   # 既定: new
 *
 * 最新記事の取得 (wrangler ログイン後):
 *   npx wrangler d1 execute healthy-person-emulator-db --remote \
 *     --command "SELECT post_id, post_title, ogp_image_url FROM dim_posts ORDER BY post_id DESC LIMIT 1"
 *
 * 注意: このスクリプトは APIキーを一切ログ出力しません。
 */
import { postToXViaBuffer, waitForBufferPostSent } from '../app/modules/social/buffer.server';
import { createPostText } from '../app/modules/social/twitter.server';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i] ?? '';
    }
  }
  return args;
}

async function main(): Promise<void> {
  const apiKey = process.env.BUFFER_API_KEY?.trim();
  if (!apiKey) {
    console.error('BUFFER_API_KEY 環境変数が設定されていません。');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const title = args.title ?? '健常者エミュレータ事例集 Buffer接続テスト';
  const url = args.url ?? 'https://healthy-person-emulator.org/';
  const messageType = (args['message-type'] ?? 'new') as 'new' | 'legendary' | 'random';
  const imageUrl = args['image-url'] || undefined;

  const text = createPostText(title, url, messageType);

  console.log('--- 投稿内容 ---');
  console.log(text);
  console.log('image:', imageUrl ?? '(なし)');
  console.log('');

  console.log('--- [1/3] Buffer に投稿 (createPost) ---');
  const { bufferPostId } = await postToXViaBuffer(apiKey, { text, imageUrl });
  console.log('Buffer Post ID:', bufferPostId);
  console.log('');

  console.log('--- [2/3] Buffer がXへ公開 (sent) するまで待機 ---');
  const xStatusId = await waitForBufferPostSent(apiKey, bufferPostId, {
    pollIntervalMs: 15_000,
    maxWaitMs: 5 * 60_000,
  });
  console.log('');

  console.log('--- [3/3] 結果 ---');
  if (xStatusId) {
    console.log('実XツイートID:', xStatusId);
    console.log('X投稿URL: https://x.com/x/status/' + xStatusId);
  } else {
    console.log(
      '実XツイートIDの回収に失敗（タイムアウト/エラー）。Buffer ダッシュボード (https://publish.buffer.com) で確認してください。',
    );
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
