// 集中化配置管理系统
import fs from "fs";
import dotenv from "dotenv";
import { createLogger } from "./logger.js";

const logger = createLogger('CONFIG');

class ConfigManager {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  loadConfig() {
    // 加载默认环境变量
    dotenv.config();

    // 优先加载 .env.local（不会提交到 git）
    if (fs.existsSync(".env.local")) {
      logger.info("使用 .env.local 文件覆盖默认配置");
      const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    } else {
      logger.info("使用默认 .env 文件，可以创建 .env.local 文件来覆盖默认设置");
    }

    // 构建配置对象
    this.config = {
      // 运行时配置
      runtime: {
        runTimeLimitMinutes: parseInt(process.env.RUN_TIME_LIMIT_MINUTES) || 20,
        maxConcurrentAccounts: parseInt(process.env.MAX_CONCURRENT_ACCOUNTS) || 4,
        delayBetweenInstances: parseInt(process.env.DELAY_BETWEEN_INSTANCES) || 10000,
        environment: process.env.NODE_ENV || 'production'
      },

      // 网站配置
      website: {
        loginUrl: process.env.WEBSITE || "https://linux.do",
        specificUser: process.env.SPECIFIC_USER || "14790897",
        isLikeSpecificUser: (process.env.LIKE_SPECIFIC_USER || "false") === "true",
        isAutoLike: (process.env.AUTO_LIKE || "true") === "true"
      },

      // 账号配置
      accounts: {
        usernames: process.env.USERNAMES ? process.env.USERNAMES.split(",") : [],
        passwords: process.env.PASSWORDS ? process.env.PASSWORDS.split(",") : []
      },

      // Telegram 配置
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        groupId: process.env.TELEGRAM_GROUP_ID,
        maxMessageLength: parseInt(process.env.TELEGRAM_MAX_MSG_LENGTH) || 4000
      },

      // RSS 配置
      rss: {
        enabled: process.env.ENABLE_RSS_FETCH === "true",
        fetchInterval: parseInt(process.env.RSS_FETCH_INTERVAL) || 300000, // 5分钟
        sources: (process.env.RSS_SOURCES || "").split(",").filter(Boolean)
      },

      // 数据库配置
      database: {
        postgresql: {
          main: process.env.POSTGRES_URI,
          cockroach: process.env.COCKROACH_URI,
          neon: process.env.NEON_URI
        },
        mongodb: {
          uri: process.env.MONGO_URI,
          dbName: process.env.MONGO_DB_NAME || "auto_read_posts"
        },
        mysql: {
          uri: process.env.AIVEN_MYSQL_URI
        },
        connectionPool: {
          maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 5,
          idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
          connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000
        }
      },

      // 浏览器配置
      browser: {
        headless: (process.env.BROWSER_HEADLESS || "true") === "true",
        timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
        userAgent: process.env.BROWSER_USER_AGENT,
        viewport: {
          width: parseInt(process.env.BROWSER_WIDTH) || 1280,
          height: parseInt(process.env.BROWSER_HEIGHT) || 720
        }
      },

      // 监控配置
      monitoring: {
        enablePerformanceMonitoring: (process.env.ENABLE_PERFORMANCE_MONITORING || "true") === "true",
        logLevel: process.env.LOG_LEVEL || "INFO",
        metricsReportInterval: parseInt(process.env.METRICS_REPORT_INTERVAL) || 3600000, // 1小时
        healthChecksEnabled: (process.env.ENABLE_HEALTH_CHECKS || "true") === "true"
      },

      // 重试配置
      retry: {
        maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3,
        baseDelay: parseInt(process.env.RETRY_BASE_DELAY) || 1000,
        maxDelay: parseInt(process.env.RETRY_MAX_DELAY) || 10000,
        enableJitter: (process.env.RETRY_ENABLE_JITTER || "true") === "true"
      }
    };

    this.validateConfig();
    logger.info("配置加载完成", { 
      accounts: this.config.accounts.usernames.length,
      rssEnabled: this.config.rss.enabled,
      databases: this.getDatabaseCount()
    });
  }

  validateConfig() {
    const errors = [];

    // 验证账号配置
    if (this.config.accounts.usernames.length !== this.config.accounts.passwords.length) {
      errors.push("用户名和密码数量不匹配");
    }

    if (this.config.accounts.usernames.length === 0) {
      errors.push("未配置任何账号");
    }

    // 验证数据库配置
    const dbCount = this.getDatabaseCount();
    if (dbCount === 0) {
      logger.warn("未配置任何数据库连接");
    }

    // 验证 Telegram 配置
    if (this.config.telegram.botToken && (!this.config.telegram.chatId && !this.config.telegram.groupId)) {
      logger.warn("配置了 Telegram Bot Token 但未配置 Chat ID 或 Group ID");
    }

    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.join(", ")}`);
    }
  }

  getDatabaseCount() {
    let count = 0;
    if (this.config.database.postgresql.main) count++;
    if (this.config.database.postgresql.cockroach) count++;
    if (this.config.database.postgresql.neon) count++;
    if (this.config.database.mongodb.uri) count++;
    if (this.config.database.mysql.uri) count++;
    return count;
  }

  get(path) {
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  set(path, value) {
    const keys = path.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    logger.info(`配置更新: ${path} = ${value}`);
  }

  getAll() {
    return { ...this.config };
  }

  // 获取运行时间限制（毫秒）
  getRunTimeLimitMs() {
    return this.config.runtime.runTimeLimitMinutes * 60 * 1000;
  }

  // 获取批次间延迟时间
  getDelayBetweenBatches(totalAccounts) {
    const runTimeLimit = this.getRunTimeLimitMs();
    const maxConcurrentAccounts = this.config.runtime.maxConcurrentAccounts;
    return runTimeLimit / Math.ceil(totalAccounts / maxConcurrentAccounts);
  }

  // 检查功能是否启用
  isFeatureEnabled(feature) {
    const featureMap = {
      'rss': this.config.rss.enabled,
      'telegram': !!(this.config.telegram.botToken && (this.config.telegram.chatId || this.config.telegram.groupId)),
      'performance_monitoring': this.config.monitoring.enablePerformanceMonitoring,
      'health_checks': this.config.monitoring.healthChecksEnabled,
      'auto_like': this.config.website.isAutoLike,
      'like_specific_user': this.config.website.isLikeSpecificUser
    };

    return featureMap[feature] || false;
  }

  // 打印配置摘要
  printSummary() {
    const summary = {
      '运行环境': this.config.runtime.environment,
      '运行时间限制': `${this.config.runtime.runTimeLimitMinutes} 分钟`,
      '账号数量': this.config.accounts.usernames.length,
      '最大并发账号': this.config.runtime.maxConcurrentAccounts,
      '数据库数量': this.getDatabaseCount(),
      'RSS 抓取': this.config.rss.enabled ? '启用' : '禁用',
      'Telegram 通知': this.isFeatureEnabled('telegram') ? '启用' : '禁用',
      '性能监控': this.config.monitoring.enablePerformanceMonitoring ? '启用' : '禁用',
      '日志级别': this.config.monitoring.logLevel
    };

    logger.info("=== 系统配置摘要 ===");
    for (const [key, value] of Object.entries(summary)) {
      logger.info(`${key}: ${value}`);
    }
    logger.info("==================");
  }
}

// 创建全局配置实例
const configManager = new ConfigManager();

export default configManager;
export { ConfigManager };
