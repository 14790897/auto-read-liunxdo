// 多数据库工具 (PostgreSQL + MongoDB + MySQL)
import fs from "fs";

import pkg from "pg";
const { Pool } = pkg;
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createLogger } from "./logger.js";
import { retryWithPolicy } from "./retry.js";
import PerformanceMonitor from "./performance.js";

// 初始化日志和性能监控
const logger = createLogger("DATABASE");
const performanceMonitor = new PerformanceMonitor();
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
      logger.info("初始化 MySQL 连接池...");
      mysqlPool = mysql.createPool({
        uri: process.env.AIVEN_MYSQL_URI,
        connectionLimit: 5,
        acquireTimeout: 60000,
        timeout: 60000,
        ssl: { rejectUnauthorized: false },
      });
      logger.info("MySQL 连接池创建成功");
      performanceMonitor.incrementCounter("database.mysql.connections.created");
    } catch (error) {
      logger.error("MySQL 连接池创建失败", { error: error.message });
      performanceMonitor.incrementCounter("database.mysql.connections.failed");
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
      logger.info("初始化 MongoDB 连接...");
      mongoClient = new MongoClient(process.env.MONGO_URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      });
      // 连接到数据库
      await mongoClient.connect();
      mongoDb = mongoClient.db("auto_read_posts"); // 使用专门的数据库名
      logger.info("MongoDB 连接成功");
      performanceMonitor.incrementCounter(
        "database.mongodb.connections.created"
      );
    } catch (error) {
      logger.error("MongoDB 连接失败", { error: error.message });
      performanceMonitor.incrementCounter(
        "database.mongodb.connections.failed"
      );
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
    logger.warn("savePosts 调用时 posts 为空或不是数组");
    return;
  }

  const startTime = Date.now();
  logger.info(`开始保存 ${posts.length} 条帖子到所有数据库`);
  performanceMonitor.incrementCounter("database.save_posts.attempts");

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

  // 并行操作所有数据库，每个数据库操作都包含重试逻辑
  const savePromises = allDatabases.map(async ({ name, pool, db, type }) => {
    return retryWithPolicy(
      async () => {
        const dbStartTime = Date.now();
        logger.info(`正在保存到 ${name}...`);
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
          for (const post of posts) {
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
              post.sourceUrl,
            ]);
          }
        }

        const duration = Date.now() - dbStartTime;
        logger.info(
          `${name} 保存成功 (${posts.length} 条记录, 耗时 ${duration}ms)`
        );
        performanceMonitor.recordTiming(
          `database.${type || "postgresql"}.save_duration`,
          duration
        );
        performanceMonitor.incrementCounter(
          `database.${type || "postgresql"}.saves.success`
        );
        return { name, success: true };
      },
      "database",
      {
        context: { databaseName: name, postsCount: posts.length },
        onRetry: (attempt, error) => {
          logger.warn(`${name} 保存重试 (第${attempt}次)`, {
            error: error.message,
          });
          performanceMonitor.incrementCounter(
            `database.${type || "postgresql"}.saves.retry`
          );
        },
      }
    ).catch((error) => {
      logger.error(`${name} 保存失败`, {
        error: error.message,
        postsCount: posts.length,
      });
      performanceMonitor.incrementCounter(
        `database.${type || "postgresql"}.saves.failed`
      );
      return { name, success: false, error: error.message };
    });
  });

  // 等待所有数据库操作完成
  const results = await Promise.allSettled(savePromises);

  // 统计结果
  const successCount = results.filter(
    (result) => result.status === "fulfilled" && result.value.success
  ).length;

  const totalDuration = Date.now() - startTime;
  logger.info(
    `数据库保存结果: ${successCount}/${allDatabases.length} 个数据库保存成功, 总耗时 ${totalDuration}ms`
  );
  performanceMonitor.recordTiming(
    "database.save_posts.total_duration",
    totalDuration
  );

  if (successCount > 0) {
    performanceMonitor.incrementCounter("database.save_posts.success");
  } else {
    performanceMonitor.incrementCounter("database.save_posts.failed");
  }

  // 如果至少有一个数据库保存成功，就认为操作成功
  if (successCount === 0) {
    throw new Error("所有数据库保存都失败了");
  }
}

export async function isGuidExists(guid) {
  if (!guid) {
    logger.warn("isGuidExists 调用时 guid 为空");
    return false;
  }

  const startTime = Date.now();
  performanceMonitor.incrementCounter("database.guid_check.attempts");

  // 优先查询主数据库 (Aiven PostgreSQL)
  try {
    const result = await retryWithPolicy(
      async () => {
        const res = await pool.query(
          "SELECT 1 FROM posts WHERE guid = $1 LIMIT 1",
          [guid]
        );
        return res.rowCount > 0;
      },
      "database",
      { context: { operation: "guid_check", database: "postgresql_main" } }
    );

    if (result) {
      const duration = Date.now() - startTime;
      logger.debug(`主数据库中找到GUID: ${guid} (耗时 ${duration}ms)`);
      performanceMonitor.recordTiming("database.guid_check.duration", duration);
      performanceMonitor.incrementCounter("database.guid_check.found");
      return true;
    }
  } catch (error) {
    logger.warn("主数据库查询GUID失败", { error: error.message, guid });
    performanceMonitor.incrementCounter("database.guid_check.main_failed");
  }

  // 如果主数据库查询失败或未找到，尝试查询备用数据库
  const allDatabases = await getAllDatabases();
  for (const { name, pool, db, type } of allDatabases.slice(1)) {
    // 跳过主数据库
    try {
      const result = await retryWithPolicy(
        async () => {
          if (type === "mongo" && db) {
            // MongoDB 查询
            const collection = db.collection("posts");
            const count = await collection.countDocuments(
              { guid: guid },
              { limit: 1 }
            );
            return count > 0;
          } else if (type === "mysql" && pool) {
            // MySQL 查询
            const [rows] = await pool.execute(
              "SELECT 1 FROM posts WHERE guid = ? LIMIT 1",
              [guid]
            );
            return rows.length > 0;
          } else if (pool) {
            // PostgreSQL 查询
            const res = await pool.query(
              "SELECT 1 FROM posts WHERE guid = $1 LIMIT 1",
              [guid]
            );
            return res.rowCount > 0;
          }
          return false;
        },
        "database",
        { context: { operation: "guid_check", database: name } }
      );

      if (result) {
        const duration = Date.now() - startTime;
        logger.info(
          `在备用数据库 ${name} 中找到GUID: ${guid} (耗时 ${duration}ms)`
        );
        performanceMonitor.recordTiming(
          "database.guid_check.duration",
          duration
        );
        performanceMonitor.incrementCounter("database.guid_check.found");
        return true;
      }
    } catch (error) {
      logger.warn(`备用数据库 ${name} 查询GUID失败`, {
        error: error.message,
        database: name,
      });
      performanceMonitor.incrementCounter("database.guid_check.backup_failed");
    }
  }

  const duration = Date.now() - startTime;
  logger.debug(`所有数据库中都未找到GUID: ${guid} (总耗时 ${duration}ms)`);
  performanceMonitor.recordTiming("database.guid_check.duration", duration);
  performanceMonitor.incrementCounter("database.guid_check.not_found");
  return false;
}

// 测试所有数据库连接
export async function testAllConnections() {
  const startTime = Date.now();
  logger.info("开始测试所有数据库连接...");
  performanceMonitor.incrementCounter("database.connection_test.attempts");

  const allDatabases = await getAllDatabases();
  const testPromises = allDatabases.map(async ({ name, pool, db, type }) => {
    const dbStartTime = Date.now();

    try {
      await retryWithPolicy(
        async () => {
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
        },
        "database",
        { context: { operation: "connection_test", database: name } }
      );

      const duration = Date.now() - dbStartTime;
      logger.info(`${name} 连接正常 (耗时 ${duration}ms)`);
      performanceMonitor.recordTiming(
        `database.${type || "postgresql"}.connection_test_duration`,
        duration
      );
      performanceMonitor.incrementCounter(
        `database.${type || "postgresql"}.connection_test.success`
      );
      return { name, connected: true, responseTime: duration };
    } catch (error) {
      const duration = Date.now() - dbStartTime;
      logger.error(`${name} 连接失败`, { error: error.message, duration });
      performanceMonitor.incrementCounter(
        `database.${type || "postgresql"}.connection_test.failed`
      );
      return {
        name,
        connected: false,
        error: error.message,
        responseTime: duration,
      };
    }
  });

  const results = await Promise.allSettled(testPromises);
  const connectedCount = results.filter(
    (result) => result.status === "fulfilled" && result.value.connected
  ).length;

  const totalDuration = Date.now() - startTime;
  logger.info(
    `数据库连接测试结果: ${connectedCount}/${allDatabases.length} 个数据库连接正常, 总耗时 ${totalDuration}ms`
  );
  performanceMonitor.recordTiming(
    "database.connection_test.total_duration",
    totalDuration
  );

  if (connectedCount > 0) {
    performanceMonitor.incrementCounter("database.connection_test.success");
  } else {
    performanceMonitor.incrementCounter("database.connection_test.failed");
  }

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
      console.error(`❌ ${name} 统计信息获取失败:`, error.message);
      return {
        name,
        totalPosts: -1,
        latestPost: null,
        status: "error",
        error: error.message,
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
      console.error(`❌ ${name} 连接关闭失败:`, error.message);
    }
  });

  await Promise.allSettled(closePromises);
  console.log("所有数据库连接关闭完成");
}
