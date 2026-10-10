// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1Repository } from './d1.server';

const migrationsDir = fileURLToPath(new URL('../../drizzle/migrations/', import.meta.url));
const supportMigration = '0007_add_post_support_reaction.sql';

describe('post reaction persistence', () => {
  let sqlite: Database.Database;
  let repository: ReturnType<typeof createD1Repository>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    for (const migration of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
      if (migration !== supportMigration) {
        sqlite.exec(readFileSync(`${migrationsDir}/${migration}`, 'utf8'));
      }
    }
    sqlite.exec(`
      INSERT INTO dim_posts (
        post_id, post_author_ip_hash, post_date_jst, post_date_gmt,
        post_content, post_title, comment_status, count_likes, count_dislikes, uuid
      ) VALUES (1, 'test-hash', '2026-10-10T09:00:00.000Z', '2026-10-10T00:00:00.000Z',
        '本文', '記事', 'open', 3, 2, 'test-post');
    `);
    sqlite.exec(readFileSync(`${migrationsDir}/${supportMigration}`, 'utf8'));

    // Execute the repository's real D1 SQL against an isolated SQLite database.
    repository = createD1Repository({
      prepare(query: string) {
        const statement = sqlite.prepare(query);
        return {
          bind(...params: unknown[]) {
            return {
              run: async () => statement.run(...params),
              raw: async () => statement.raw().all(...params),
              all: async () => ({ results: statement.all(...params) }),
            };
          },
        };
      },
    } as unknown as D1Database);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('initializes existing articles with zero support without changing their votes', async () => {
    expect(await repository.getPostByPostId(1)).toMatchObject({
      countLikes: 3,
      countDislikes: 2,
      countSupports: 0,
    });
  });

  it('records support independently and returns it with the article', async () => {
    await repository.recordPostVote(1, 'support', 'test-voter');

    expect(await repository.getPostByPostId(1)).toMatchObject({
      countLikes: 3,
      countDislikes: 2,
      countSupports: 1,
    });
    expect(sqlite.prepare('SELECT vote_type_int FROM fct_post_vote_history').all()).toEqual([
      { vote_type_int: 2 },
    ]);
  });

  it.each([
    ['like', 1, 4, 2],
    ['dislike', -1, 3, 3],
  ] as const)('preserves %s votes and leaves support unchanged', async (type, value, likes, dislikes) => {
    await repository.recordPostVote(1, type, 'test-voter');

    expect(await repository.getPostByPostId(1)).toMatchObject({
      countLikes: likes,
      countDislikes: dislikes,
      countSupports: 0,
    });
    expect(sqlite.prepare('SELECT vote_type_int FROM fct_post_vote_history').all()).toEqual([
      { vote_type_int: value },
    ]);
  });

  it('keeps support-only articles out of the recent-likes ranking', async () => {
    const newPost = await repository.createPostWithTags({
      postTitle: '新しい記事',
      postContent: '本文',
      hashedUserIpAddress: 'test-hash',
    });
    expect((await repository.getPostByPostId(newPost.postId)).countSupports).toBe(0);

    await repository.recordPostVote(newPost.postId, 'support', 'test-voter');
    await repository.recordPostVote(1, 'like', 'test-voter');

    const feed = await repository.getFeedPosts(1, 'likes');
    expect(feed.meta.totalCount).toBe(1);
    expect(feed.result.map((post) => post.postId)).toEqual([1]);
  });
});
