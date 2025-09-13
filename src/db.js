// 多数据库工具 (PostgreSQL + MongoDB + MySQL)
import fs from "fs";

import pkg from "pg";
const { Pool } = pkg;
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// Utility function to format error information for better logging
function formatErrorInfo(error) {
  if (!error) return { errorMsg: '未知错误', errorCode: '无错误代码' };
  
  let errorMsg = error?.message || error?.toString() || '未知错误';
  const errorCode = error?.code || '无错误代码';
  
  // Handle AggregateError specially
  if (error instanceof AggregateError && error.errors?.length > 0) {
    const innerError = error.errors[0];
    const innerMsg = innerError?.message || innerError?.toString() || '内部错误';
    errorMsg = `${errorMsg} (${innerMsg})`;
  }
  
  return { errorMsg, errorCode };
}
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
// 备用数据库连接池 (Neon)
const neonPool = new Pool({
  connectionString: process.env.NEON_URI,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

// MySQL 连接池 (Aiven MySQL)
let mysqlPool;

// 初始化 MySQL 连接池
async function initMySQL() {
  if (process.env.AIVEN_MYSQL_URI && !mysqlPool) {
    try {
      mysqlPool = mysql.createPool({
        uri: process.env.AIVEN_MYSQL_URI,
        connectionLimit: 5,
        acquireTimeout: 60000,
        timeout: 60000,
        ssl: { rejectUnauthorized: false },
      });
      console.log("✅ MySQL 连接池创建成功");
    } catch (error) {
      console.error("❌ MySQL 连接池创建失败:", error.message);
      mysqlPool = null;
    }
  }
  return mysqlPool;
}

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
  // { name: "Neon", pool: neonPool },
];

// 获取所有数据库连接数组 (包括 MongoDB 和 MySQL)
async function getAllDatabases() {
  const mongoDb = await initMongoDB();
  const mysqlPool = await initMySQL();

  return [
    ...allPools,
    ...(mongoDb ? [{ name: "MongoDB", db: mongoDb, type: "mongo" }] : []),
    ...(mysqlPool
      ? [{ name: "Aiven MySQL", pool: mysqlPool, type: "mysql" }]
      : []),
  ];
}

export async function savePosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    console.warn("无效的帖子数据或空数组，跳过保存");
    return;
  }

  // 验证帖子数据
  const validPosts = posts.filter(post => {
    if (!post || !post.guid || typeof post.guid !== 'string' || post.guid.trim() === '') {
      console.warn(`跳过无效帖子数据: ${JSON.stringify({title: post?.title, guid: post?.guid})}`);
      return false;
    }
    return true;
  });

  if (validPosts.length === 0) {
    console.warn("没有有效的帖子数据，跳过保存");
    return;
  }

  const allDatabases = await getAllDatabases();

  if (allDatabases.length === 0) {
    console.warn("没有可用的数据库连接，跳过保存");
    return;
  }

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
  const savePromises = allDatabases.map(async ({ name, pool, db, type }) => {
    try {
      console.log(`正在保存到 ${name}...`);

      if (type === "mongo" && db) {
        // MongoDB 操作
        const collection = db.collection("posts");

        // 准备 MongoDB 文档
        const mongoDocuments = validPosts.map((post) => ({
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
      } else if (type === "mysql" && pool) {
        // MySQL 操作
        const mysqlCreateTableQuery = `
          CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title TEXT,
            creator TEXT,
            description TEXT,
            link TEXT,
            pubDate TEXT,
            guid VARCHAR(500) UNIQUE,
            guidIsPermaLink TEXT,
            source TEXT,
            sourceUrl TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        const mysqlInsertQuery = `
          INSERT INTO posts (title, creator, description, link, pubDate, guid, guidIsPermaLink, source, sourceUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          creator = VALUES(creator),
          description = VALUES(description),
          link = VALUES(link),
          pubDate = VALUES(pubDate),
          guidIsPermaLink = VALUES(guidIsPermaLink),
          source = VALUES(source),
          sourceUrl = VALUES(sourceUrl)
        `;

        // 建表
        await pool.execute(mysqlCreateTableQuery);

        // 插入数据
        for (const post of validPosts) {
          await pool.execute(mysqlInsertQuery, [
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
      } else if (pool) {
        // PostgreSQL 操作
        // 建表
        await pool.query(createTableQuery);

        // 插入数据
        for (const post of validPosts) {
          await pool.query(insertQuery, [
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

      console.log(`✅ ${name} 保存成功 (${validPosts.length} 条记录)`);
      return { name, success: true };
    } catch (error) {
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.error(`❌ ${name} 保存失败 [${errorCode}]:`, errorMsg);
      return { name, success: false, error: errorMsg };
    }
  });

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
  // 验证输入参数
  if (!guid || typeof guid !== 'string' || guid.trim() === '') {
    console.warn(`无效的GUID参数: ${JSON.stringify(guid)}`);
    return false;
  }

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
    const { errorMsg, errorCode } = formatErrorInfo(error);
    console.warn(`主数据库查询GUID失败 [${errorCode}]: ${errorMsg}`);
  }
  // 如果主数据库查询失败或未找到，尝试查询备用数据库
  const allDatabases = await getAllDatabases();
  for (const { name, pool, db, type } of allDatabases.slice(1)) {
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
      } else if (type === "mysql" && pool) {
        // MySQL 查询
        const [rows] = await pool.execute(
          "SELECT 1 FROM posts WHERE guid = ? LIMIT 1",
          [guid]
        );
        if (rows.length > 0) {
          console.log(`在备用数据库 ${name} 中找到GUID: ${guid}`);
          return true;
        }
      } else if (pool) {
        // PostgreSQL 查询
        const res = await pool.query(
          "SELECT 1 FROM posts WHERE guid = $1 LIMIT 1",
          [guid]
        );
        if (res.rowCount > 0) {
          console.log(`在备用数据库 ${name} 中找到GUID: ${guid}`);
          return true;
        }
      }
    } catch (error) {
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.warn(`备用数据库 ${name} 查询GUID失败 [${errorCode}]: ${errorMsg}`);
    }
  }

  return false;
}

// 测试所有数据库连接
export async function testAllConnections() {
  console.log("正在测试所有数据库连接...");
  const allDatabases = await getAllDatabases();
  const testPromises = allDatabases.map(async ({ name, pool, db, type }) => {
    try {
      if (type === "mongo" && db) {
        // 测试 MongoDB 连接
        await db.admin().ping();
      } else if (type === "mysql" && pool) {
        // 测试 MySQL 连接
        await pool.execute("SELECT 1");
      } else if (pool) {
        // 测试 PostgreSQL 连接
        await pool.query("SELECT 1");
      }
      console.log(`✅ ${name} 连接正常`);
      return { name, connected: true };
    } catch (error) {
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.error(`❌ ${name} 连接失败 [${errorCode}]:`, errorMsg);
      return { name, connected: false, error: errorMsg };
    }
  });

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
  const statsPromises = allDatabases.map(async ({ name, pool, db, type }) => {
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
      } else if (type === "mysql" && pool) {
        // MySQL 统计
        const [countResult] = await pool.execute(
          "SELECT COUNT(*) as count FROM posts"
        );
        const [latestResult] = await pool.execute(
          "SELECT created_at FROM posts ORDER BY created_at DESC LIMIT 1"
        );

        stats = {
          name,
          totalPosts: parseInt(countResult[0].count),
          latestPost: latestResult[0]?.created_at || null,
          status: "healthy",
        };
      } else if (pool) {
        // PostgreSQL 统计
        const countResult = await pool.query(
          "SELECT COUNT(*) as count FROM posts"
        );
        const latestResult = await pool.query(
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
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.error(`❌ ${name} 统计信息获取失败 [${errorCode}]:`, errorMsg);
      return {
        name,
        totalPosts: -1,
        latestPost: null,
        status: "error",
        error: errorMsg,
      };
    }
  });

  const results = await Promise.allSettled(statsPromises);
  return results.map((result) =>
    result.status === "fulfilled" ? result.value : result.reason
  );
}

// 关闭所有数据库连接
export async function closeAllConnections() {
  console.log("正在关闭所有数据库连接...");
  const allDatabases = await getAllDatabases();
  const closePromises = allDatabases.map(async ({ name, pool, type }) => {
    try {
      if (type === "mongo") {
        // 关闭 MongoDB 连接
        if (mongoClient) {
          await mongoClient.close();
          mongoClient = null;
          mongoDb = null;
        }
      } else if (type === "mysql" && pool) {
        // 关闭 MySQL 连接
        await pool.end();
        mysqlPool = null;
      } else if (pool) {
        // 关闭 PostgreSQL 连接
        await pool.end();
      }
      console.log(`✅ ${name} 连接已关闭`);
    } catch (error) {
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.error(`❌ ${name} 连接关闭失败 [${errorCode}]:`, errorMsg);
    }
  });

  await Promise.allSettled(closePromises);
  console.log("所有数据库连接关闭完成");
}

// 保存话题 JSON 数据的函数
export async function saveTopicData(topicData) {
  if (!topicData || !topicData.id) {
    console.warn("无效的话题数据，跳过保存");
    return;
  }

  const allDatabases = await getAllDatabases();

  const createTopicsTableQuery = `
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER UNIQUE,
      title TEXT,
      slug TEXT,
      posts_count INTEGER,
      created_at TIMESTAMP,
      last_posted_at TIMESTAMP,
      views INTEGER,
      like_count INTEGER,
      category_id INTEGER,
      tags TEXT[],
      raw_data JSONB,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const insertTopicQuery = `
    INSERT INTO topics (topic_id, title, slug, posts_count, created_at, last_posted_at, views, like_count, category_id, tags, raw_data)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (topic_id) DO UPDATE SET
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      posts_count = EXCLUDED.posts_count,
      last_posted_at = EXCLUDED.last_posted_at,
      views = EXCLUDED.views,
      like_count = EXCLUDED.like_count,
      tags = EXCLUDED.tags,
      raw_data = EXCLUDED.raw_data,
      saved_at = CURRENT_TIMESTAMP
  `;

  const savePromises = allDatabases.map(async ({ name, pool, db, type }) => {
    try {
      console.log(`正在保存话题数据到 ${name}...`);

      if (type === "mongo" && db) {
        // MongoDB 操作
        const collection = db.collection("topics");
        
        const mongoDocument = {
          topic_id: topicData.id,
          title: topicData.title,
          slug: topicData.slug,
          posts_count: topicData.posts_count,
          created_at: new Date(topicData.created_at),
          last_posted_at: topicData.last_posted_at ? new Date(topicData.last_posted_at) : null,
          views: topicData.views,
          like_count: topicData.like_count,
          category_id: topicData.category_id,
          tags: topicData.tags || [],
          raw_data: topicData,
          saved_at: new Date(),
        };

        await collection.updateOne(
          { topic_id: topicData.id },
          { $set: mongoDocument },
          { upsert: true }
        );
      } else if (type === "mysql" && pool) {        // MySQL 操作
        const mysqlCreateTableQuery = `
          CREATE TABLE IF NOT EXISTS topics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            topic_id INT UNIQUE,
            title TEXT,
            slug TEXT,
            posts_count INT,
            created_at DATETIME,
            last_posted_at DATETIME NULL,
            views INT,
            like_count INT,
            category_id INT,
            tags JSON,
            raw_data JSON,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        const mysqlInsertQuery = `
          INSERT INTO topics (topic_id, title, slug, posts_count, created_at, last_posted_at, views, like_count, category_id, tags, raw_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          slug = VALUES(slug),
          posts_count = VALUES(posts_count),
          last_posted_at = VALUES(last_posted_at),
          views = VALUES(views),
          like_count = VALUES(like_count),
          tags = VALUES(tags),
          raw_data = VALUES(raw_data),
          saved_at = CURRENT_TIMESTAMP
        `;        await pool.execute(mysqlCreateTableQuery);
        
        // 转换日期格式为 MySQL 兼容格式 (YYYY-MM-DD HH:MM:SS)
        const formatDateForMySQL = (dateString) => {
          if (!dateString) return null;
          const date = new Date(dateString);
          return date.toISOString().slice(0, 19).replace('T', ' ');
        };
        
        await pool.execute(mysqlInsertQuery, [
          topicData.id,
          topicData.title,
          topicData.slug,
          topicData.posts_count,
          formatDateForMySQL(topicData.created_at),
          formatDateForMySQL(topicData.last_posted_at),
          topicData.views,
          topicData.like_count,
          topicData.category_id,
          JSON.stringify(topicData.tags || []),
          JSON.stringify(topicData),
        ]);
      } else if (pool) {
        // PostgreSQL 操作
        await pool.query(createTopicsTableQuery);
        
        await pool.query(insertTopicQuery, [
          topicData.id,
          topicData.title,
          topicData.slug,
          topicData.posts_count,
          topicData.created_at,
          topicData.last_posted_at,
          topicData.views,
          topicData.like_count,
          topicData.category_id,
          topicData.tags || [],
          topicData,
        ]);
      }

      console.log(`✅ ${name} 话题数据保存成功 (话题ID: ${topicData.id})`);
      return { name, success: true };
    } catch (error) {
      const { errorMsg, errorCode } = formatErrorInfo(error);
      console.error(`❌ ${name} 话题数据保存失败 [${errorCode}]:`, errorMsg);
      return { name, success: false, error: errorMsg };
    }
  });

  const results = await Promise.allSettled(savePromises);
  const successCount = results.filter(
    (result) => result.status === "fulfilled" && result.value.success
  ).length;

  console.log(
    `话题数据保存结果: ${successCount}/${allDatabases.length} 个数据库保存成功`
  );

  if (successCount === 0) {
    throw new Error("所有数据库话题数据保存都失败了");
  }
}
