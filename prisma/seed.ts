import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

async function getRecords(filePath: string, columns: Array<string>) {
  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
  return csv.parse(fileContent, {
    columns: columns,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    quote: '"',
    from_line: 2,
    escape: null,
})
}

async function main() {
  const dimPostsRecords = await getRecords(
    'prisma/dimPosts.csv',
    [
      'post_id',
      'post_author_ip_hash',
      'post_date_jst',
      'post_date_gmt',
      'post_content',
      'post_title',
      'comment_status',
      'count_likes',
      'count_dislikes',
      'uuid',
    ]
  );
  // dimPostRecordsで\\nを\nに変換
  for (const record of dimPostsRecords) {
    record.post_content = record.post_content.replace(/\\n/g, '\n');
  }

  for (const record of dimPostsRecords) {
    await prisma.dimPosts.create({
      data: {
        postId: parseInt(record.post_id) ?? 0,
        postAuthorIPHash: record.post_author_ip_hash,
        postDateJst: new Date(record.post_date_jst),
        postDateGmt: new Date(record.post_date_gmt),
        postContent: record.post_content,
        postTitle: record.post_title,
        commentStatus: record.comment_status,
        countLikes: parseInt(record.count_likes) ?? 0,
        countDislikes: parseInt(record.count_dislikes) ?? 0,
        uuid: record.uuid,
      }
    });
  }

  const dimTagsRecords = await getRecords(
    'prisma/dimTags.csv',
    [
      'tag_id',
      'tag_name',
    ]
  );
  for (const record of dimTagsRecords) {
    await prisma.dimTags.create({
      data: {
        tagId: parseInt(record.tag_id),
        tagName: record.tag_name,
      }
    });
  }

  const relPostTagsRecords = await getRecords(
    'prisma/relPostTags.csv',
    [
      'post_id',
      'tag_id',
    ]
  );
  for (const record of relPostTagsRecords) {
    await prisma.relPostTags.create({
      data: {
        postId: parseInt(record.post_id),
        tagId: parseInt(record.tag_id),
      }
    });
  }



  const dimCommentsRecords = await getRecords(
    'prisma/dimComments.csv',
    [
      'comment_id',
      'post_id',
      'comment_author',
      'comment_author_ip_hash',
      'comment_date_jst',
      'comment_date_gmt',
      'comment_content',
      'comment_parent',
      'uuid',
    ]
  );

  // dimCommentsRecordsで\\nを\nに変換
    for (const record of dimCommentsRecords) {
        record.comment_content = record.comment_content.replace(/\\n/g, '\n');
    }
  for (const record of dimCommentsRecords) {
    await prisma.dimComments.create({
      data: {
        commentId: parseInt(record.comment_id),
        postId: parseInt(record.post_id),
        commentAuthor: record.comment_author,
        commentAuthorIpHash: record.comment_author_ip_hash,
        commentDateJst: new Date(record.comment_date_jst),
        commentDateGmt: new Date(record.comment_date_gmt),
        commentContent: record.comment_content,
        commentParent: parseInt(record.comment_parent),
        uuid: record.uuid,
      }
    });
  }

  const fctPostVoteHistoryRecords = await getRecords(
    'prisma/fctPostVoteHistory.csv',
    [
      'vote_date_gmt',
      'vote_user_ip_hash',
      'post_id',
      'vote_type_int',
      'vote_date_jst',
      'post_vote_id',
    ]
  );
  for (const record of fctPostVoteHistoryRecords) {
    await prisma.fctPostVoteHisotry.create({
      data: {
        voteDateGmt: new Date(record.vote_date_gmt),
        voteUserIpHash: record.vote_user_ip_hash,
        postId: parseInt(record.post_id),
        voteTypeInt: parseInt(record.vote_type_int),
        vote_date_jst: new Date(record.vote_date_jst),
        postVoteId: parseInt(record.post_vote_id),
      }
    });
  }

  const fctCommentVoteHistoryRecords = await getRecords(
    'prisma/fctCommentVoteHistory.csv',
    [
      'comment_vote_id',
      'vote_user_ip_hash',
      'comment_id',
      'vote_type',
      'post_id',
      'comment_vote_date_jst',
      'comment_vote_utc',
    ]
  );

  for (const record of fctCommentVoteHistoryRecords) {
    await prisma.fctCommentVoteHisotry.create({
      data: {
        commentVoteId: parseInt(record.comment_vote_id),
        voteUserIpHash: record.vote_user_ip_hash,
        commentId: parseInt(record.comment_id),
        voteType: parseInt(record.vote_type),
        postId: parseInt(record.post_id),
        commentVoteDateJst: new Date(record.comment_vote_date_jst),
        comment_vote_date_utc: new Date(record.comment_vote_utc),
      }
    });
  }

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
})
