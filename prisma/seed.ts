import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('シードデータの投入を開始します...');

  // タグデータの投入
  const tags = [
    { tagId: 1, tagName: 'テスト' },
    { tagId: 575, tagName: '殿堂入り' },
    { tagId: 986, tagName: 'コミュニティ選' },
  ];

  for (const tag of tags) {
    await prisma.dimTags.upsert({
      where: { tagId: tag.tagId },
      update: {},
      create: tag,
    });
  }
  console.log('タグデータを投入しました');

  const postData = [
    { postAuthorIPHash: 'test_hash_01', postTitle: 'テスト投稿01：友人への冗談', countLikes: 5 },
    { postAuthorIPHash: 'test_hash_02', postTitle: 'テスト投稿02：上司への提案', countLikes: 8 },
    { postAuthorIPHash: 'test_hash_03', postTitle: 'テスト投稿03：同居人への感謝', countLikes: 12 },
    { postAuthorIPHash: 'test_hash_04', postTitle: 'テスト投稿04：電車内のマナー', countLikes: 3 },
    { postAuthorIPHash: 'test_hash_05', postTitle: 'テスト投稿05：会議中のスマホ', countLikes: 6 },
    { postAuthorIPHash: 'test_hash_06', postTitle: 'テスト投稿06：コンビニでの態度', countLikes: 4 },
    { postAuthorIPHash: 'test_hash_07', postTitle: 'テスト投稿07：友人の誕生日', countLikes: 7 },
    { postAuthorIPHash: 'test_hash_08', postTitle: 'テスト投稿08：飲み会での話', countLikes: 9 },
    { postAuthorIPHash: 'test_hash_09', postTitle: 'テスト投稿09：ミスの隠蔽', countLikes: 11 },
    { postAuthorIPHash: 'test_hash_10', postTitle: 'テスト投稿10：家族への相談', countLikes: 6 },
    { postAuthorIPHash: 'test_hash_11', postTitle: 'テスト投稿11：SNSの投稿', countLikes: 15 },
    { postAuthorIPHash: 'test_hash_12', postTitle: 'テスト投稿12：時間の遅刻', countLikes: 8 },
    { postAuthorIPHash: 'test_hash_13', postTitle: 'テスト投稿13：後輩への相談対応', countLikes: 20 },
    { postAuthorIPHash: 'test_hash_14', postTitle: 'テスト投稿14：プロジェクトへの貢献', countLikes: 18 },
    { postAuthorIPHash: 'test_hash_15', postTitle: 'テスト投稿15：近所への挨拶', countLikes: 22 },
  ];

  const postContent = '<h2>5W1H+Then状況説明</h2><p>テスト投稿のコンテンツです。</p><h2>健常行動ブレイクポイント</h2><p>テストポイントです。</p><h2>どうすればよかったか</h2><p>テスト対応方法です。</p>';

  const createdPosts = [];
  for (const post of postData) {
    const created = await prisma.dimPosts.create({
      data: {
        postAuthorIPHash: post.postAuthorIPHash,
        postContent,
        postTitle: post.postTitle,
        commentStatus: 'open',
        countLikes: post.countLikes,
        countDislikes: 0,
      },
    });
    createdPosts.push(created);
  }
  console.log(`${createdPosts.length}件の投稿データを投入しました`);

  // 殿堂入りタグを付ける投稿（後半5件）
  const famedPosts = createdPosts.slice(10);
  // コミュニティ選タグを付ける投稿（後半8件）
  const communityPosts = createdPosts.slice(7);

  for (const post of createdPosts) {
    await prisma.relPostTags.create({
      data: { postId: post.postId, tagId: 1 },
    });
  }
  for (const post of famedPosts) {
    await prisma.relPostTags.create({
      data: { postId: post.postId, tagId: 575 },
    });
  }
  for (const post of communityPosts) {
    await prisma.relPostTags.create({
      data: { postId: post.postId, tagId: 986 },
    });
  }
  console.log('タグの関連付けを完了しました');

  // コメントデータの投入（最初の12件の投稿に1件ずつ）
  for (let i = 0; i < 12; i++) {
    await prisma.dimComments.create({
      data: {
        postId: createdPosts[i].postId,
        commentAuthor: 'テストコメントユーザー',
        commentContent: '参考になりました。自分も気をつけようと思います。',
        commentParent: 0,
      },
    });
  }
  console.log('コメントデータを投入しました');

  // いいね履歴の投入（偶数番の投稿8件）
  const votedPosts = createdPosts.filter((_, i) => i % 2 === 0);
  for (const post of votedPosts) {
    await prisma.fctPostVoteHistory.create({
      data: {
        postId: post.postId,
        voteUserIpHash: `test_voter_${post.postId}`,
        voteTypeInt: 1,
      },
    });
  }
  console.log('いいね履歴を投入しました');

  console.log('シードデータの投入が完了しました');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
