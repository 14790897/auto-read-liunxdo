// PostgreSQL 数据库工具
import fs from "fs";

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();
if (fs.existsSync(".env.local")) {
  console.log("Using .env.local file to supply config environment variables");
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else {
  console.log(
    "Using .env file to supply config environment variables, you can create a .env.local file to overwrite defaults, it doesn't upload to git"
  );
}
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false }
});

export async function savePosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;
  // 先删除旧表，确保唯一约束生效
//   await pool.query('DROP TABLE IF EXISTS posts');
  // 建表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT,
      creator TEXT,
      description TEXT,
      link TEXT,
      pubDate TEXT,
      guid TEXT UNIQUE,
      guidIsPermaLink TEXT,
      source TEXT,
      sourceUrl TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // 插入数据
  const insertQuery = `
    INSERT INTO posts (title, creator, description, link, pubDate, guid, guidIsPermaLink, source, sourceUrl)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (guid) DO NOTHING
  `;
  for (const post of posts) {
    await pool.query(insertQuery, [
      post.title,
      post.creator,
      post.description,
      post.link,
      post.pubDate,
      post.guid,
      post.guidIsPermaLink,
      post.source,
      post.sourceUrl
    ]);
  }
}

export async function isGuidExists(guid) {
  const res = await pool.query("SELECT 1 FROM posts WHERE guid = $1 LIMIT 1", [
    guid,
  ]);
  // console.log("isGuidExists查询结果:", res.rows); 存在的返回[ { '?column?': 1 } ]
  return res.rowCount > 0;
}
