import { systemLogger } from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      accounts: {
        total: 0,
        successful: 0,
        failed: 0,
        averageProcessTime: 0
      },
      database: {
        operations: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      },
      rss: {
        fetched: 0,
        processed: 0,
        failed: 0,
        newPosts: 0
      },
      system: {
        startTime: Date.now(),
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
      this.timers = new Map();
    this.intervals = new Map();
    this.counters = new Map(); // 添加计数器存储
    
    // 启动定期监控
    this.startMonitoring();
  }

  // 增加计数器
  incrementCounter(key, value = 1) {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    systemLogger.debug(`计数器更新: ${key} = ${current + value}`);
  }

  // 记录时间
  recordTiming(key, duration) {
    systemLogger.debug(`时间记录: ${key} = ${duration}ms`);
  }

  // 开始账号处理
  startAccountProcessing(totalCount) {
    this.metrics.accounts.total = totalCount;
    systemLogger.info(`开始处理 ${totalCount} 个账号`);
  }

  // 完成账号处理  
  completeAccountProcessing(username, success, duration = 0) {
    if (success) {
      this.metrics.accounts.successful++;
    } else {
      this.metrics.accounts.failed++;
    }
    
    // 更新平均处理时间
    const completed = this.metrics.accounts.successful + this.metrics.accounts.failed;
    if (completed > 0) {
      this.metrics.accounts.averageProcessTime = 
        (this.metrics.accounts.averageProcessTime * (completed - 1) + duration) / completed;
    }
  }

  // 获取指标数据 (兼容性方法)
  getMetrics() {
    return this.metrics;
  }

  // 开始计时
  startTimer(operation) {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, Date.now());
    return timerId;
  }

  // 结束计时并记录
  endTimer(timerId, category = 'general') {
    const startTime = this.timers.get(timerId);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.timers.delete(timerId);

    // 更新平均时间
    if (category === 'account') {
      const total = this.metrics.accounts.total;
      this.metrics.accounts.averageProcessTime = 
        (this.metrics.accounts.averageProcessTime * total + duration) / (total + 1);
    } else if (category === 'database') {
      const total = this.metrics.database.operations;
      this.metrics.database.averageResponseTime = 
        (this.metrics.database.averageResponseTime * total + duration) / (total + 1);
    }

    systemLogger.logPerformance(category, duration);
    return duration;
  }

  // 记录账户操作
  recordAccountOperation(success, duration = 0) {
    this.metrics.accounts.total++;
    if (success) {
      this.metrics.accounts.successful++;
    } else {
      this.metrics.accounts.failed++;
    }
  }

  // 记录数据库操作
  recordDatabaseOperation(success, duration = 0) {
    this.metrics.database.operations++;
    if (success) {
      this.metrics.database.successful++;
    } else {
      this.metrics.database.failed++;
    }
  }

  // 记录RSS操作
  recordRssOperation(type, count = 1) {
    switch (type) {
      case 'fetched':
        this.metrics.rss.fetched += count;
        break;
      case 'processed':
        this.metrics.rss.processed += count;
        break;
      case 'failed':
        this.metrics.rss.failed += count;
        break;
      case 'newPosts':
        this.metrics.rss.newPosts += count;
        break;
    }
  }

  // 获取系统资源使用情况
  getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memoryUsage.heapUsed / (1024 * 1024); // MB
    
    return {
      uptime: Math.floor((Date.now() - this.metrics.system.startTime) / 1000), // 秒
      memoryUsage: this.metrics.system.memoryUsage,
      memoryTotal: memoryUsage.heapTotal / (1024 * 1024),
      memoryRSS: memoryUsage.rss / (1024 * 1024)
    };
  }

  // 获取完整统计信息
  getStats() {
    const systemMetrics = this.getSystemMetrics();
    
    return {
      accounts: {
        ...this.metrics.accounts,
        successRate: this.metrics.accounts.total > 0 ? 
          (this.metrics.accounts.successful / this.metrics.accounts.total * 100).toFixed(2) + '%' : '0%'
      },
      database: {
        ...this.metrics.database,
        successRate: this.metrics.database.operations > 0 ? 
          (this.metrics.database.successful / this.metrics.database.operations * 100).toFixed(2) + '%' : '0%'
      },
      rss: {
        ...this.metrics.rss,
        successRate: this.metrics.rss.fetched > 0 ? 
          ((this.metrics.rss.fetched - this.metrics.rss.failed) / this.metrics.rss.fetched * 100).toFixed(2) + '%' : '0%'
      },
      system: systemMetrics,
      timestamp: new Date().toISOString()
    };
  }

  // 启动定期监控
  startMonitoring() {
    // 每5分钟记录一次系统状态
    const systemMonitor = setInterval(() => {
      const stats = this.getStats();
      systemLogger.info('系统状态监控', stats);
      
      // 内存使用警告
      if (stats.system.memoryUsage > 500) { // 500MB
        systemLogger.warn('内存使用量较高', { 
          memoryUsage: `${stats.system.memoryUsage.toFixed(2)} MB` 
        });
      }
    }, 5 * 60 * 1000);

    this.intervals.set('systemMonitor', systemMonitor);

    // 每小时生成统计报告
    const hourlyReport = setInterval(() => {
      this.generateHourlyReport();
    }, 60 * 60 * 1000);

    this.intervals.set('hourlyReport', hourlyReport);
  }

  // 生成小时报告
  generateHourlyReport() {
    const stats = this.getStats();
    const report = {
      reportTime: new Date().toISOString(),
      summary: {
        totalAccounts: stats.accounts.total,
        successfulAccounts: stats.accounts.successful,
        accountSuccessRate: stats.accounts.successRate,
        newPostsFound: stats.rss.newPosts,
        databaseOperations: stats.database.operations,
        systemUptime: `${Math.floor(stats.system.uptime / 3600)}h ${Math.floor((stats.system.uptime % 3600) / 60)}m`,
        memoryUsage: `${stats.system.memoryUsage.toFixed(2)} MB`
      }
    };

    systemLogger.info('小时统计报告', report);
    return report;
  }

  // 重置统计信息
  reset() {
    this.metrics = {
      accounts: { total: 0, successful: 0, failed: 0, averageProcessTime: 0 },
      database: { operations: 0, successful: 0, failed: 0, averageResponseTime: 0 },
      rss: { fetched: 0, processed: 0, failed: 0, newPosts: 0 },
      system: { startTime: Date.now(), memoryUsage: 0, cpuUsage: 0 }
    };
    systemLogger.info('性能监控统计已重置');
  }

  // 停止监控
  stopMonitoring() {
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    systemLogger.info('性能监控已停止');
  }

  // 生成最终报告
  generateFinalReport() {
    const finalStats = this.getStats();
    const report = {
      ...finalStats,
      runtime: `${Math.floor(finalStats.system.uptime / 3600)}h ${Math.floor((finalStats.system.uptime % 3600) / 60)}m ${finalStats.system.uptime % 60}s`
    };

    systemLogger.info('最终运行报告', report);
    return report;
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 退出时生成最终报告
process.on('exit', () => {
  performanceMonitor.generateFinalReport();
});

process.on('SIGINT', () => {
  performanceMonitor.generateFinalReport();
  process.exit(0);
});

export default PerformanceMonitor;
