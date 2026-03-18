import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // dim_postsの最大行サイズ
  const postSizes = await prisma.$queryRaw`
    SELECT post_id, length(post_content) as content_bytes, length(post_title) as title_bytes, pg_column_size(dim_posts.*) as total_row_bytes
    FROM dim_posts ORDER BY pg_column_size(dim_posts.*) DESC LIMIT 10
  `;
  console.log('=== dim_posts top 10 largest rows ===');
  console.table(postSizes);

  // fct_post_edit_historyの最大行サイズ
  const editSizes = await prisma.$queryRaw`
    SELECT post_id, post_revision_number,
           length(post_content_before_edit) as before_bytes,
           length(post_content_after_edit) as after_bytes,
           pg_column_size(fct_post_edit_history.*) as total_row_bytes
    FROM fct_post_edit_history ORDER BY pg_column_size(fct_post_edit_history.*) DESC LIMIT 10
  `;
  console.log('\n=== fct_post_edit_history top 10 largest rows ===');
  console.table(editSizes);

  // 全テーブルの最大行サイズ
  const allTables = await prisma.$queryRaw`
    SELECT 'dim_posts' as table_name, max(pg_column_size(dim_posts.*)) as max_row_bytes FROM dim_posts
    UNION ALL SELECT 'fct_post_edit_history', max(pg_column_size(fct_post_edit_history.*)) FROM fct_post_edit_history
    UNION ALL SELECT 'dim_comments', max(pg_column_size(dim_comments.*)) FROM dim_comments
    UNION ALL SELECT 'dim_tags', max(pg_column_size(dim_tags.*)) FROM dim_tags
    UNION ALL SELECT 'dim_users', max(pg_column_size(dim_users.*)) FROM dim_users
    UNION ALL SELECT 'fct_post_vote_history', max(pg_column_size(fct_post_vote_history.*)) FROM fct_post_vote_history
    UNION ALL SELECT 'fct_comment_vote_history', max(pg_column_size(fct_comment_vote_history.*)) FROM fct_comment_vote_history
    UNION ALL SELECT 'fct_user_bookmark_activity', max(pg_column_size(fct_user_bookmark_activity.*)) FROM fct_user_bookmark_activity
    ORDER BY max_row_bytes DESC
  `;
  console.log('\n=== All tables max row size ===');
  console.table(allTables);

  // D1上限との比較
  const D1_LIMIT = 2 * 1024 * 1024; // 2MB
  console.log('\n=== D1 2MB limit comparison ===');
  for (const row of allTables as any[]) {
    const bytes = Number(row.max_row_bytes);
    const pct = ((bytes / D1_LIMIT) * 100).toFixed(1);
    const status = bytes > D1_LIMIT ? 'EXCEEDS LIMIT' : 'OK';
    console.log(`${row.table_name}: ${bytes.toLocaleString()} bytes (${pct}% of 2MB limit) [${status}]`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
