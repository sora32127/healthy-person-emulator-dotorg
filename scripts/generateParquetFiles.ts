import { PrismaClient } from "@prisma/client";
import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

type SearchRecord = {
  postId: number;
  postTitle: string;
  postContent: string;
  postDateGmt: Date;
  countLikes: number;
  countDislikes: number;
  ogpImageUrl: string | null;
  tagNames: string[];
  countComments: number;
}

type TagRecord = {
  postId: number;
  tagName: string;
}

async function getDuckDBConnection() {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    
    await connection.run("INSTALL parquet");
    await connection.run("LOAD parquet");
    return connection;
}

async function generateSearchParquet() {
  console.log("Generating search parquet data...");
  
  const posts = await prisma.dimPosts.findMany({
    select: {
      postId: true,
      postTitle: true,
      postContent: true,
      postDateGmt: true,
      countLikes: true,
      countDislikes: true,
      ogpImageUrl: true,
      rel_post_tags: {
        select: {
          dimTag: {
            select: {
              tagName: true,
            },
          },
        },
      },
      dimComments: {
        select: {
          commentId: true,
        },
      },
    },
    orderBy: {
      postId: "asc",
    },
  });

  const searchRecords: SearchRecord[] = posts.map((post) => ({
    postId: post.postId,
    postTitle: post.postTitle,
    postContent: post.postContent,
    postDateGmt: post.postDateGmt,
    countLikes: post.countLikes,
    countDislikes: post.countDislikes,
    ogpImageUrl: post.ogpImageUrl,
    tagNames: post.rel_post_tags.map((tag) => tag.dimTag.tagName),
    countComments: post.dimComments.length,
  }));

  return searchRecords;
}

async function generateTagsParquet() {
  console.log("Generating tags parquet data...");
  
  const postTags = await prisma.relPostTags.findMany({
    select: {
      postId: true,
      dimTag: {
        select: {
          tagName: true,
        },
      },
    },
    orderBy: [
      { postId: "asc" },
      { dimTag: { tagName: "asc" } },
    ],
  });

  const tagRecords: TagRecord[] = postTags.map((pt) => ({
    postId: pt.postId,
    tagName: pt.dimTag.tagName,
  }));

  return tagRecords;
}

async function writeSearchAsParquet(
  data: SearchRecord[],
  fileName: string,
  outputDir: string
) {
  const filePath = path.join(outputDir, fileName);
  
  try {
    const connection = await getDuckDBConnection();
    
    await connection.run(`
      CREATE TABLE search (
        postId INTEGER,
        postTitle VARCHAR,
        postContent VARCHAR,
        postDateGmt TIMESTAMP,
        countLikes INTEGER,
        countDislikes INTEGER,
        ogpImageUrl VARCHAR,
        tagNames VARCHAR[],
        countComments INTEGER
      );
    `);
    
    for (const record of data) {
      const tagNamesArray = record.tagNames.length > 0
        ? `ARRAY[${record.tagNames.map((tag) => `'${tag.replace(/'/g, "''")}'`).join(", ")}]`
        : "ARRAY[]::VARCHAR[]";
      
      const insertQuery = `
        INSERT INTO search VALUES (
          ${record.postId},
          '${record.postTitle.replace(/'/g, "''")}',
          '${record.postContent.replace(/'/g, "''")}',
          '${record.postDateGmt.toISOString()}'::TIMESTAMP,
          ${record.countLikes},
          ${record.countDislikes},
          ${record.ogpImageUrl ? `'${record.ogpImageUrl.replace(/'/g, "''")}'` : "NULL"},
          ${tagNamesArray},
          ${record.countComments}
        );
      `;
      
      await connection.run(insertQuery);
    }
    
    await connection.run(`
      COPY search TO '${filePath}' (FORMAT PARQUET, COMPRESSION SNAPPY);
    `);
    
    console.log(`Written ${data.length} records to ${filePath}`);
  } catch (error) {
    console.error("Error writing search parquet:", error);
    throw error;
  }
}

async function writeTagsAsParquet(
  data: TagRecord[],
  fileName: string,
  outputDir: string
) {
  const filePath = path.join(outputDir, fileName);
  
  try {
    const connection = await getDuckDBConnection();
    await connection.run(`
      CREATE TABLE tags (
        postId INTEGER,
        tagName VARCHAR
      );
    `);
    
    for (const record of data) {
      const insertQuery = `
        INSERT INTO tags VALUES (
          ${record.postId},
          '${record.tagName.replace(/'/g, "''")}'
        );
      `;
      
      await connection.run(insertQuery);
    }
    
    await connection.run(`
      COPY tags TO '${filePath}' (FORMAT PARQUET, COMPRESSION SNAPPY);
    `);
    
    console.log(`Written ${data.length} records to ${filePath}`);
  } catch (error) {
    console.error("Error writing tags parquet:", error);
    throw error;
  }
}

async function main() {
  try {
    const outputDir = path.join(__dirname, "..", "public", "parquet");
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const searchFileName =
      process.env.SEARCH_PARQUET_FILE_NAME || "gcs-demo-search.parquet";
    const tagsFileName =
      process.env.TAGS_PARQUET_FILE_NAME || "gcs-demo-tags.parquet";

    const searchRecords = await generateSearchParquet();
    await writeSearchAsParquet(searchRecords, searchFileName, outputDir);

    const tagRecords = await generateTagsParquet();
    await writeTagsAsParquet(tagRecords, tagsFileName, outputDir);

    console.log("Parquet file generation completed successfully!");
  } catch (error) {
    console.error("Error generating parquet files:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
