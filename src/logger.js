import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, '../logs');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志级别
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(module = 'SYSTEM') {
    this.module = module;
    this.logLevel = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO;
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.module}] ${message}${dataStr}\n`;
  }

  writeToFile(level, message) {
    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, message, 'utf8');
  }

  log(level, levelName, message, data = null) {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelName, message, data);
      console.log(formattedMessage.trim());
      this.writeToFile(levelName, formattedMessage);
    }
  }

  error(message, data = null) {
    this.log(LogLevel.ERROR, 'ERROR', message, data);
  }

  warn(message, data = null) {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  info(message, data = null) {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  debug(message, data = null) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  // 账户操作日志
  logAccountAction(username, action, result, details = null) {
    this.info(`账户操作`, {
      username,
      action,
      result,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 数据库操作日志
  logDatabaseAction(database, action, result, count = null) {
    this.info(`数据库操作`, {
      database,
      action,
      result,
      count,
      timestamp: new Date().toISOString()
    });
  }

  // RSS操作日志
  logRssAction(topicId, action, result, details = null) {
    this.info(`RSS操作`, {
      topicId,
      action,
      result,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 性能监控日志
  logPerformance(operation, duration, details = null) {
    this.info(`性能监控`, {
      operation,
      duration: `${duration}ms`,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 清理旧日志文件 (保留7天)
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(logDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      files.forEach(file => {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            this.info(`已清理旧日志文件: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('清理旧日志文件失败', { error: error.message });
    }
  }
}

// 创建不同模块的logger实例
export const systemLogger = new Logger('SYSTEM');
export const dbLogger = new Logger('DATABASE');
export const accountLogger = new Logger('ACCOUNT');
export const rssLogger = new Logger('RSS');

// 创建logger的工厂函数
export function createLogger(module) {
  return new Logger(module);
}

export default Logger;
