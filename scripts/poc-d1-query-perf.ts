// scripts/poc-d1-query-perf.ts
// D1（SQLite）のクエリ性能をPoC検証するスクリプト
//
// 手順:
// 1. SQLiteデータベースを作成しスキーマを適用
// 2. PostgreSQLからサンプルデータを読み込み、SQLiteに投入
// 3. 主要クエリを実行し、性能を計測

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = new Database(':memory:'); // インメモリSQLite

async function createSchema() {
  db.exec(`
    CREATE TABLE dim_posts (
      post_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_author_ip_hash TEXT,
      post_date_jst TEXT,
      post_date_gmt TEXT,
      post_content TEXT,
      post_title TEXT,
      comment_status TEXT DEFAULT 'open',
      count_likes INTEGER DEFAULT 0,
      count_dislikes INTEGER DEFAULT 0,
      uuid TEXT,
      token_count INTEGER,
      ogp_image_url TEXT,
      tweet_id_of_first_tweet TEXT,
      bluesky_post_uri_of_first_post TEXT,
      misskey_note_id_of_first_note TEXT,
      is_welcomed TEXT,
      is_welcomed_explanation TEXT
    );
    CREATE INDEX idx_posts_date ON dim_posts(post_date_gmt);
    CREATE INDEX idx_posts_likes ON dim_posts(count_likes);
    CREATE INDEX idx_posts_uuid ON dim_posts(uuid);

    CREATE TABLE dim_tags (
      tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_name TEXT NOT NULL
    );

    CREATE TABLE rel_post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY (post_id) REFERENCES dim_posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES dim_tags(tag_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_rel_post_tags_tag ON rel_post_tags(tag_id);
    CREATE INDEX idx_rel_post_tags_post ON rel_post_tags(post_id);

    CREATE TABLE dim_comments (
      comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      comment_author TEXT DEFAULT '名無しの読者',
      comment_author_ip_hash TEXT,
      comment_date_jst TEXT,
      comment_date_gmt TEXT,
      comment_content TEXT,
      comment_parent INTEGER,
      uuid TEXT,
      FOREIGN KEY (post_id) REFERENCES dim_posts(post_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_comments_post ON dim_comments(post_id);
    CREATE INDEX idx_comments_date ON dim_comments(comment_date_gmt);

    CREATE TABLE fct_post_vote_history (
      post_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_date_gmt TEXT,
      vote_user_ip_hash TEXT,
      post_id INTEGER,
      vote_type_int INTEGER,
      vote_date_jst TEXT,
      FOREIGN KEY (post_id) REFERENCES dim_posts(post_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_vote_date_type ON fct_post_vote_history(vote_date_gmt, vote_type_int);

    CREATE TABLE fct_comment_vote_history (
      comment_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_user_ip_hash TEXT,
      comment_id INTEGER,
      vote_type TEXT,
      post_id INTEGER,
      comment_vote_date_jst TEXT,
      comment_vote_date_utc TEXT,
      FOREIGN KEY (comment_id) REFERENCES dim_comments(comment_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_comment_vote_comment ON fct_comment_vote_history(comment_id);
    CREATE INDEX idx_comment_vote_post ON fct_comment_vote_history(post_id);
  `);
}

async function loadData() {
  console.log('Loading data from PostgreSQL...');

  // dim_posts（全件） - $queryRawUnsafe to bypass Prisma null validation on tokenCount
  const posts: any[] = await prisma.$queryRawUnsafe(`
    SELECT post_id, post_author_ip_hash, post_date_jst, post_date_gmt, post_content, post_title, comment_status, count_likes, count_dislikes, uuid, token_count, ogp_image_url, tweet_id_of_first_tweet, bluesky_post_uri_of_first_post, misskey_note_id_of_first_note, is_welcomed, is_welcomed_explanation
    FROM dim_posts
  `);
  console.log(`  dim_posts: ${posts.length} rows`);

  const insertPost = db.prepare(`
    INSERT INTO dim_posts (post_id, post_author_ip_hash, post_date_jst, post_date_gmt, post_content, post_title, comment_status, count_likes, count_dislikes, uuid, token_count, ogp_image_url, tweet_id_of_first_tweet, bluesky_post_uri_of_first_post, misskey_note_id_of_first_note, is_welcomed, is_welcomed_explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const toSqlite = (v: any): string | number | bigint | Buffer | null => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber(); // Decimal
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint' || Buffer.isBuffer(v)) return v;
    return String(v);
  };
  const insertPostTx = db.transaction((rows: any[]) => {
    for (const r of rows) {
      insertPost.run(
        toSqlite(r.post_id), toSqlite(r.post_author_ip_hash), toSqlite(r.post_date_jst), toSqlite(r.post_date_gmt),
        toSqlite(r.post_content), toSqlite(r.post_title), toSqlite(r.comment_status),
        toSqlite(r.count_likes) ?? 0, toSqlite(r.count_dislikes) ?? 0, toSqlite(r.uuid),
        toSqlite(r.token_count), toSqlite(r.ogp_image_url), toSqlite(r.tweet_id_of_first_tweet),
        toSqlite(r.bluesky_post_uri_of_first_post), toSqlite(r.misskey_note_id_of_first_note),
        toSqlite(r.is_welcomed), toSqlite(r.is_welcomed_explanation)
      );
    }
  });
  insertPostTx(posts);

  // dim_tags
  const tags: any[] = await prisma.$queryRawUnsafe('SELECT tag_id, tag_name FROM dim_tags');
  console.log(`  dim_tags: ${tags.length} rows`);
  const insertTag = db.prepare('INSERT INTO dim_tags (tag_id, tag_name) VALUES (?, ?)');
  const insertTagTx = db.transaction((rows: any[]) => {
    for (const r of rows) insertTag.run(toSqlite(r.tag_id), toSqlite(r.tag_name));
  });
  insertTagTx(tags);

  // rel_post_tags
  const relPostTags: any[] = await prisma.$queryRawUnsafe('SELECT post_id, tag_id FROM rel_post_tags');
  console.log(`  rel_post_tags: ${relPostTags.length} rows`);
  const insertRelPostTag = db.prepare('INSERT INTO rel_post_tags (post_id, tag_id) VALUES (?, ?)');
  const insertRelTx = db.transaction((rows: any[]) => {
    for (const r of rows) insertRelPostTag.run(toSqlite(r.post_id), toSqlite(r.tag_id));
  });
  insertRelTx(relPostTags);

  // dim_comments
  const comments: any[] = await prisma.$queryRawUnsafe('SELECT comment_id, post_id, comment_author, comment_author_ip_hash, comment_date_jst, comment_date_gmt, comment_content, comment_parent, uuid FROM dim_comments');
  console.log(`  dim_comments: ${comments.length} rows`);
  const insertComment = db.prepare('INSERT INTO dim_comments (comment_id, post_id, comment_author, comment_author_ip_hash, comment_date_jst, comment_date_gmt, comment_content, comment_parent, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertCommentTx = db.transaction((rows: any[]) => {
    for (const r of rows) insertComment.run(toSqlite(r.comment_id), toSqlite(r.post_id), toSqlite(r.comment_author), toSqlite(r.comment_author_ip_hash), toSqlite(r.comment_date_jst), toSqlite(r.comment_date_gmt), toSqlite(r.comment_content), toSqlite(r.comment_parent), toSqlite(r.uuid));
  });
  insertCommentTx(comments);

  // fct_post_vote_history
  const votes: any[] = await prisma.$queryRawUnsafe('SELECT post_vote_id, vote_date_gmt, vote_user_ip_hash, post_id, vote_type_int, vote_date_jst FROM fct_post_vote_history');
  console.log(`  fct_post_vote_history: ${votes.length} rows`);
  const insertVote = db.prepare('INSERT INTO fct_post_vote_history (post_vote_id, vote_date_gmt, vote_user_ip_hash, post_id, vote_type_int, vote_date_jst) VALUES (?, ?, ?, ?, ?, ?)');
  const insertVoteTx = db.transaction((rows: any[]) => {
    for (const r of rows) insertVote.run(toSqlite(r.post_vote_id), toSqlite(r.vote_date_gmt), toSqlite(r.vote_user_ip_hash), toSqlite(r.post_id), toSqlite(r.vote_type_int), toSqlite(r.vote_date_jst));
  });
  insertVoteTx(votes);

  // fct_comment_vote_history
  const commentVotes: any[] = await prisma.$queryRawUnsafe('SELECT comment_vote_id, vote_user_ip_hash, comment_id, vote_type, post_id, comment_vote_date_jst, comment_vote_date_utc FROM fct_comment_vote_history');
  console.log(`  fct_comment_vote_history: ${commentVotes.length} rows`);
  const insertCommentVote = db.prepare('INSERT INTO fct_comment_vote_history (comment_vote_id, vote_user_ip_hash, comment_id, vote_type, post_id, comment_vote_date_jst, comment_vote_date_utc) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertCommentVoteTx = db.transaction((rows: any[]) => {
    for (const r of rows) insertCommentVote.run(toSqlite(r.comment_vote_id), toSqlite(r.vote_user_ip_hash), toSqlite(r.comment_id), toSqlite(r.vote_type), toSqlite(r.post_id), toSqlite(r.comment_vote_date_jst), toSqlite(r.comment_vote_date_utc));
  });
  insertCommentVoteTx(commentVotes);
}

function benchmark(name: string, fn: () => any, iterations: number = 100): { avg: number; min: number; max: number; result: any } {
  let result: any;
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 5; i++) fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  return {
    avg: times.reduce((a, b) => a + b) / times.length,
    min: times[0],
    max: times[times.length - 1],
    result
  };
}

async function runBenchmarks() {
  console.log('\n=== Query Performance Benchmarks (100 iterations each) ===\n');

  // 1. getFeedPosts相当: ORDER BY count_likes DESC OFFSET/LIMIT
  const feedLikes = benchmark('getFeedPosts (likes, page 1)', () => {
    return db.prepare(`
      SELECT post_id, post_title, post_date_gmt, count_likes, count_dislikes, ogp_image_url
      FROM dim_posts ORDER BY count_likes DESC LIMIT 12 OFFSET 0
    `).all();
  });
  console.log(`1. getFeedPosts (ORDER BY likes DESC, LIMIT 12): avg=${feedLikes.avg.toFixed(2)}ms, min=${feedLikes.min.toFixed(2)}ms, max=${feedLikes.max.toFixed(2)}ms`);

  // 2. getFeedPosts with deep offset
  const feedDeep = benchmark('getFeedPosts (likes, page 100)', () => {
    return db.prepare(`
      SELECT post_id, post_title, post_date_gmt, count_likes, count_dislikes, ogp_image_url
      FROM dim_posts ORDER BY count_likes DESC LIMIT 12 OFFSET 1200
    `).all();
  });
  console.log(`2. getFeedPosts (deep offset 1200): avg=${feedDeep.avg.toFixed(2)}ms, min=${feedDeep.min.toFixed(2)}ms, max=${feedDeep.max.toFixed(2)}ms`);

  // 3. getPostByPostId + tags
  const postWithTags = benchmark('getPostByPostId + tags', () => {
    const post = db.prepare('SELECT * FROM dim_posts WHERE post_id = ?').get(1000);
    const tags = db.prepare(`
      SELECT dt.tag_id, dt.tag_name FROM rel_post_tags rpt
      INNER JOIN dim_tags dt ON rpt.tag_id = dt.tag_id
      WHERE rpt.post_id = ? ORDER BY dt.tag_name ASC
    `).all(1000);
    return { post, tags };
  });
  console.log(`3. getPostByPostId + tags (JOIN): avg=${postWithTags.avg.toFixed(2)}ms, min=${postWithTags.min.toFixed(2)}ms, max=${postWithTags.max.toFixed(2)}ms`);

  // 4. getCommentsByPostId + vote aggregation
  const commentsWithVotes = benchmark('getCommentsByPostId + votes', () => {
    const comments = db.prepare('SELECT * FROM dim_comments WHERE post_id = ? ORDER BY comment_date_gmt DESC').all(1000);
    const voteAgg = db.prepare(`
      SELECT comment_id, vote_type, COUNT(*) as cnt
      FROM fct_comment_vote_history WHERE post_id = ?
      GROUP BY comment_id, vote_type
    `).all(1000);
    return { comments, voteAgg };
  });
  console.log(`4. getCommentsByPostId + vote GROUP BY: avg=${commentsWithVotes.avg.toFixed(2)}ms, min=${commentsWithVotes.min.toFixed(2)}ms, max=${commentsWithVotes.max.toFixed(2)}ms`);

  // 5. getTagsCounts (JOIN + GROUP BY + COUNT)
  const tagCounts = benchmark('getTagsCounts', () => {
    return db.prepare(`
      SELECT dt.tag_name, COUNT(rpt.post_id) as post_count
      FROM dim_tags dt
      INNER JOIN rel_post_tags rpt ON dt.tag_id = rpt.tag_id
      GROUP BY dt.tag_id, dt.tag_name
      ORDER BY post_count DESC
    `).all();
  });
  console.log(`5. getTagsCounts (JOIN + GROUP BY): avg=${tagCounts.avg.toFixed(2)}ms, min=${tagCounts.min.toFixed(2)}ms, max=${tagCounts.max.toFixed(2)}ms`);

  // 6. getRandomPosts (ORDER BY uuid with random offset)
  const randomPosts = benchmark('getRandomPosts', () => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM dim_posts').get() as any;
    const offset = Math.floor(Math.random() * count.cnt);
    return db.prepare(`
      SELECT post_id, post_title, post_date_gmt, count_likes, count_dislikes, ogp_image_url
      FROM dim_posts ORDER BY uuid LIMIT 12 OFFSET ?
    `).all(offset);
  });
  console.log(`6. getRandomPosts (random offset): avg=${randomPosts.avg.toFixed(2)}ms, min=${randomPosts.min.toFixed(2)}ms, max=${randomPosts.max.toFixed(2)}ms`);

  // 7. Complex: posts by tag with pagination
  const postsByTag = benchmark('getRecentPostsByTagId', () => {
    return db.prepare(`
      SELECT dp.post_id, dp.post_title, dp.post_date_gmt, dp.count_likes, dp.count_dislikes, dp.ogp_image_url
      FROM dim_posts dp
      INNER JOIN rel_post_tags rpt ON dp.post_id = rpt.post_id
      WHERE rpt.tag_id = 5
      ORDER BY dp.post_date_gmt DESC
      LIMIT 12 OFFSET 0
    `).all();
  });
  console.log(`7. getRecentPostsByTagId (JOIN + ORDER + LIMIT): avg=${postsByTag.avg.toFixed(2)}ms, min=${postsByTag.min.toFixed(2)}ms, max=${postsByTag.max.toFixed(2)}ms`);

  // Summary
  console.log('\n=== Summary ===');
  console.log('Note: These are in-memory SQLite benchmarks. Real D1 will have network latency but also caching.');
  console.log('D1 read replicas provide edge caching for reads, which should offset network latency for most queries.');
}

async function main() {
  try {
    await createSchema();
    await loadData();
    await runBenchmarks();
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
