// 多数据库工具 (PostgreSQL + MongoDB)
import fs from "fs";

import pkg from "pg";
const { Pool } = pkg;
import { MongoClient } from "mongodb";
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
// 主数据库连接池 (Aiven PostgreSQL)
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

// 备用数据库连接池 (CockroachDB)
const cockroachPool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

// 备用数据库连接池 (Neon)
const neonPool = new Pool({
  connectionString: process.env.NEON_URI,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

// MongoDB 连接
let mongoClient;
let mongoDb;

// 初始化 MongoDB 连接
async function initMongoDB() {
  if (process.env.MONGO_URI && !mongoClient) {
    try {
      mongoClient = new MongoClient(process.env.MONGO_URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      });
      // 连接到数据库
      await mongoClient.connect();
      mongoDb = mongoClient.db("auto_read_posts"); // 使用专门的数据库名
      console.log("✅ MongoDB 连接成功");
    } catch (error) {
      console.error("❌ MongoDB 连接失败:", error.message);
      mongoClient = null;
      mongoDb = null;
    }
  }
  return mongoDb;
}

// 所有数据库连接池数组 (PostgreSQL)
const allPools = [
  { name: "Aiven PostgreSQL", pool: pool },
  { name: "CockroachDB", pool: cockroachPool },
  { name: "Neon", pool: neonPool },
];

// 获取所有数据库连接数组 (包括 MongoDB)
async function getAllDatabases() {
  const db = await initMongoDB();
  return [
    ...allPools,
    ...(db ? [{ name: "MongoDB", db: db, type: "mongo" }] : []),
  ];
}

export async function savePosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;

  const allDatabases = await getAllDatabases();

  const createTableQuery = `
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
  `;

  const insertQuery = `
    INSERT INTO posts (title, creator, description, link, pubDate, guid, guidIsPermaLink, source, sourceUrl)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (guid) DO NOTHING
  `;

  // 并行操作所有数据库
  const savePromises = allDatabases.map(
    async ({ name, pool: dbPool, db, type }) => {
      try {
        console.log(`正在保存到 ${name}...`);

        if (type === "mongo" && db) {
          // MongoDB 操作
          const collection = db.collection("posts");

          // 准备 MongoDB 文档
          const mongoDocuments = posts.map((post) => ({
            title: post.title,
            creator: post.creator,
            description: post.description,
            link: post.link,
            pubDate: post.pubDate,
            guid: post.guid,
            guidIsPermaLink: post.guidIsPermaLink,
            source: post.source,
            sourceUrl: post.sourceUrl,
            created_at: new Date(),
          }));

          // 使用 upsert 操作避免重复
          const bulkOps = mongoDocuments.map((doc) => ({
            updateOne: {
              filter: { guid: doc.guid },
              update: { $set: doc },
              upsert: true,
            },
          }));

          if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
          }
        } else if (dbPool) {
          // PostgreSQL 操作
          // 建表
          await dbPool.query(createTableQuery);

          // 插入数据
          for (const post of posts) {
            await dbPool.query(insertQuery, [
              post.title,
              post.creator,
              post.description,
              post.link,
              post.pubDate,
              post.guid,
              post.guidIsPermaLink,
              post.source,
              post.sourceUrl,
            ]);
          }
        }

        console.log(`✅ ${name} 保存成功 (${posts.length} 条记录)`);
        return { name, success: true };
      } catch (error) {
        console.error(`❌ ${name} 保存失败:`, error.message);
        return { name, success: false, error: error.message };
      }
    }
  );

  // 等待所有数据库操作完成
  const results = await Promise.allSettled(savePromises);

  // 统计结果
  const successCount = results.filter(
    (result) => result.status === "fulfilled" && result.value.success
  ).length;

  console.log(
    `数据库保存结果: ${successCount}/${allDatabases.length} 个数据库保存成功`
  );

  // 如果至少有一个数据库保存成功，就认为操作成功
  if (successCount === 0) {
    throw new Error("所有数据库保存都失败了");
  }
}

export async function isGuidExists(guid) {
  // 优先查询主数据库 (Aiven PostgreSQL)
  try {
    const res = await pool.query(
      "SELECT 1 FROM posts WHERE guid = $1 LIMIT 1",
      [guid]
    );
    // console.log("isGuidExists查询结果:", res.rows); 存在的返回[ { '?column?': 1 } ]
    if (res.rowCount > 0) {
      return true;
    }
  } catch (error) {
    console.warn(`主数据库查询GUID失败: ${error.message}`);
  }

  // 如果主数据库查询失败或未找到，尝试查询备用数据库
  const allDatabases = await getAllDatabases();
  for (const { name, pool: dbPool, db, type } of allDatabases.slice(1)) {
    // 跳过主数据库
    try {
      if (type === "mongo" && db) {
        // MongoDB 查询
        const collection = db.collection("posts");
        const count = await collection.countDocuments(
          { guid: guid },
          { limit: 1 }
        );
        if (count > 0) {
          console.log(`在备用数据库 ${name} 中找到GUID: ${guid}`);
          return true;
        }
      } else if (dbPool) {
        // PostgreSQL 查询
        const res = await dbPool.query(
          "SELECT 1 FROM posts WHERE guid = $1 LIMIT 1",
          [guid]
        );
        if (res.rowCount > 0) {
          console.log(`在备用数据库 ${name} 中找到GUID: ${guid}`);
          return true;
        }
      }
    } catch (error) {
      console.warn(`备用数据库 ${name} 查询GUID失败: ${error.message}`);
    }
  }

  return false;
}

// 测试所有数据库连接
export async function testAllConnections() {
  console.log("正在测试所有数据库连接...");

  const allDatabases = await getAllDatabases();
  const testPromises = allDatabases.map(
    async ({ name, pool: dbPool, db, type }) => {
      try {
        if (type === "mongo" && db) {
          // 测试 MongoDB 连接
          await db.admin().ping();
        } else if (dbPool) {
          // 测试 PostgreSQL 连接
          await dbPool.query("SELECT 1");
        }
        console.log(`✅ ${name} 连接正常`);
        return { name, connected: true };
      } catch (error) {
        console.error(`❌ ${name} 连接失败:`, error.message);
        return { name, connected: false, error: error.message };
      }
    }
  );

  const results = await Promise.allSettled(testPromises);
  const connectedCount = results.filter(
    (result) => result.status === "fulfilled" && result.value.connected
  ).length;

  console.log(
    `数据库连接测试结果: ${connectedCount}/${allDatabases.length} 个数据库连接正常`
  );
  return results;
}

// 获取所有数据库的统计信息
export async function getAllDatabaseStats() {
  console.log("正在获取所有数据库统计信息...");

  const allDatabases = await getAllDatabases();
  const statsPromises = allDatabases.map(
    async ({ name, pool: dbPool, db, type }) => {
      try {
        let stats;

        if (type === "mongo" && db) {
          // MongoDB 统计
          const collection = db.collection("posts");
          const totalPosts = await collection.countDocuments();
          const latestPost = await collection.findOne(
            {},
            { sort: { created_at: -1 } }
          );

          stats = {
            name,
            totalPosts,
            latestPost: latestPost?.created_at || null,
            status: "healthy",
          };
        } else if (dbPool) {
          // PostgreSQL 统计
          const countResult = await dbPool.query(
            "SELECT COUNT(*) as count FROM posts"
          );
          const latestResult = await dbPool.query(
            "SELECT created_at FROM posts ORDER BY created_at DESC LIMIT 1"
          );

          stats = {
            name,
            totalPosts: parseInt(countResult.rows[0].count),
            latestPost: latestResult.rows[0]?.created_at || null,
            status: "healthy",
          };
        }

        console.log(`📊 ${name}: ${stats.totalPosts} 条记录`);
        return stats;
      } catch (error) {
        console.error(`❌ ${name} 统计信息获取失败:`, error.message);
        return {
          name,
          totalPosts: -1,
          latestPost: null,
          status: "error",
          error: error.message,
        };
      }
    }
  );

  const results = await Promise.allSettled(statsPromises);
  return results.map((result) =>
    result.status === "fulfilled" ? result.value : result.reason
  );
}

// 关闭所有数据库连接
export async function closeAllConnections() {
  console.log("正在关闭所有数据库连接...");

  const allDatabases = await getAllDatabases();
  const closePromises = allDatabases.map(
    async ({ name, pool: dbPool, type }) => {
      try {
        if (type === "mongo") {
          // 关闭 MongoDB 连接
          if (mongoClient) {
            await mongoClient.close();
            mongoClient = null;
            mongoDb = null;
          }
        } else if (dbPool) {
          // 关闭 PostgreSQL 连接
          await dbPool.end();
        }
        console.log(`✅ ${name} 连接已关闭`);
      } catch (error) {
        console.error(`❌ ${name} 连接关闭失败:`, error.message);
      }
    }
  );

  await Promise.allSettled(closePromises);
  console.log("所有数据库连接关闭完成");
}
