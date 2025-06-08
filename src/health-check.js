// 系统健康检查模块
import { createLogger } from "./logger.js";
import { testAllConnections } from "./db.js";
import configManager from "./config.js";
import PerformanceMonitor from "./performance.js";

const logger = createLogger('HEALTH');

class HealthCheckManager {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.healthStatus = {
      overall: 'unknown',
      lastCheck: null,
      components: {}
    };
    
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  registerDefaultChecks() {
    // 数据库连接检查
    this.registerCheck('database', async () => {
      const results = await testAllConnections();
      const connectedCount = results.filter(
        result => result.status === 'fulfilled' && result.value.connected
      ).length;
      
      const totalDatabases = results.length;
      const isHealthy = connectedCount > 0; // 至少一个数据库连接正常
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          connected: connectedCount,
          total: totalDatabases,
          databases: results.map(result => ({
            name: result.value?.name || 'unknown',
            connected: result.value?.connected || false,
            error: result.value?.error,
            responseTime: result.value?.responseTime
          }))
        },
        message: `${connectedCount}/${totalDatabases} 数据库连接正常`
      };
    });

    // 系统资源检查
    this.registerCheck('system', async () => {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // 内存使用率检查（假设超过 512MB RSS 为警告）
      const memoryWarningThreshold = 512 * 1024 * 1024; // 512MB
      const isMemoryHealthy = memUsage.rss < memoryWarningThreshold;
      
      // 运行时间检查
      const maxRuntime = configManager.getRunTimeLimitMs() / 1000; // 转换为秒
      const isUptimeHealthy = uptime < maxRuntime;
      
      const isHealthy = isMemoryHealthy && isUptimeHealthy;
      
      return {
        status: isHealthy ? 'healthy' : 'warning',
        details: {
          memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
          },
          uptime: Math.round(uptime),
          maxRuntime: Math.round(maxRuntime)
        },
        message: `内存使用: ${Math.round(memUsage.rss / 1024 / 1024)}MB, 运行时间: ${Math.round(uptime)}s`
      };
    });

    // 配置检查
    this.registerCheck('configuration', async () => {
      try {
        const accountCount = configManager.get('accounts.usernames').length;
        const passwordCount = configManager.get('accounts.passwords').length;
        const databaseCount = configManager.getDatabaseCount();
        
        const isAccountConfigValid = accountCount > 0 && accountCount === passwordCount;
        const isDatabaseConfigValid = databaseCount > 0;
        
        const isHealthy = isAccountConfigValid && isDatabaseConfigValid;
        
        return {
          status: isHealthy ? 'healthy' : 'unhealthy',
          details: {
            accounts: accountCount,
            databases: databaseCount,
            rssEnabled: configManager.isFeatureEnabled('rss'),
            telegramEnabled: configManager.isFeatureEnabled('telegram')
          },
          message: `${accountCount} 个账号, ${databaseCount} 个数据库`
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          details: { error: error.message },
          message: '配置验证失败'
        };
      }
    });

    // Telegram 连接检查（如果启用）
    if (configManager.isFeatureEnabled('telegram')) {
      this.registerCheck('telegram', async () => {
        try {
          // 这里可以添加实际的 Telegram API 连接测试
          // 暂时返回基于配置的状态
          const hasToken = !!configManager.get('telegram.botToken');
          const hasRecipient = !!(configManager.get('telegram.chatId') || configManager.get('telegram.groupId'));
          
          const isHealthy = hasToken && hasRecipient;
          
          return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            details: {
              hasToken,
              hasRecipient,
              chatId: !!configManager.get('telegram.chatId'),
              groupId: !!configManager.get('telegram.groupId')
            },
            message: isHealthy ? 'Telegram 配置正常' : 'Telegram 配置不完整'
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            details: { error: error.message },
            message: 'Telegram 检查失败'
          };
        }
      });
    }
  }

  registerCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
    logger.debug(`注册健康检查: ${name}`);
  }

  async runCheck(name) {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      throw new Error(`未找到健康检查: ${name}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await checkFunction();
      const duration = Date.now() - startTime;
      
      const checkResult = {
        ...result,
        duration,
        timestamp: new Date().toISOString()
      };

      this.healthStatus.components[name] = checkResult;
      this.performanceMonitor.recordTiming(`health_check.${name}.duration`, duration);
      this.performanceMonitor.incrementCounter(`health_check.${name}.${result.status}`);

      logger.debug(`健康检查 ${name}: ${result.status}`, { duration, details: result.details });
      return checkResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult = {
        status: 'error',
        message: error.message,
        duration,
        timestamp: new Date().toISOString()
      };

      this.healthStatus.components[name] = errorResult;
      this.performanceMonitor.recordTiming(`health_check.${name}.duration`, duration);
      this.performanceMonitor.incrementCounter(`health_check.${name}.error`);

      logger.error(`健康检查 ${name} 执行失败`, { error: error.message, duration });
      return errorResult;
    }
  }

  async runAllChecks() {
    const startTime = Date.now();
    logger.info('开始执行所有健康检查...');

    const checkNames = Array.from(this.checks.keys());
    const checkPromises = checkNames.map(name => this.runCheck(name));
    
    await Promise.allSettled(checkPromises);

    // 计算整体健康状态
    const components = this.healthStatus.components;
    const componentStatuses = Object.values(components).map(c => c.status);
    
    let overallStatus;
    if (componentStatuses.every(status => status === 'healthy')) {
      overallStatus = 'healthy';
    } else if (componentStatuses.some(status => status === 'unhealthy' || status === 'error')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'warning';
    }

    this.healthStatus.overall = overallStatus;
    this.healthStatus.lastCheck = new Date().toISOString();

    const duration = Date.now() - startTime;
    this.performanceMonitor.recordTiming('health_check.all.duration', duration);
    this.performanceMonitor.incrementCounter(`health_check.all.${overallStatus}`);

    logger.info(`健康检查完成: ${overallStatus}`, { 
      duration, 
      components: Object.keys(components).length,
      healthy: componentStatuses.filter(s => s === 'healthy').length,
      warnings: componentStatuses.filter(s => s === 'warning').length,
      unhealthy: componentStatuses.filter(s => s === 'unhealthy').length,
      errors: componentStatuses.filter(s => s === 'error').length
    });

    return this.healthStatus;
  }

  getHealthStatus() {
    return { ...this.healthStatus };
  }

  getHealthSummary() {
    const status = this.getHealthStatus();
    const components = status.components;
    
    return {
      status: status.overall,
      lastCheck: status.lastCheck,
      summary: {
        total: Object.keys(components).length,
        healthy: Object.values(components).filter(c => c.status === 'healthy').length,
        warning: Object.values(components).filter(c => c.status === 'warning').length,
        unhealthy: Object.values(components).filter(c => c.status === 'unhealthy').length,
        error: Object.values(components).filter(c => c.status === 'error').length
      },
      components: Object.entries(components).map(([name, data]) => ({
        name,
        status: data.status,
        message: data.message,
        duration: data.duration
      }))
    };
  }

  // 创建健康检查报告
  generateReport() {
    const summary = this.getHealthSummary();
    const lines = [
      '=== 系统健康检查报告 ===',
      `整体状态: ${summary.status.toUpperCase()}`,
      `检查时间: ${summary.lastCheck}`,
      '',
      '组件状态:',
      ...summary.components.map(comp => 
        `  ${comp.name}: ${comp.status.toUpperCase()} - ${comp.message} (${comp.duration}ms)`
      ),
      '',
      `总计: ${summary.summary.total} 个组件`,
      `健康: ${summary.summary.healthy}, 警告: ${summary.summary.warning}, 异常: ${summary.summary.unhealthy}, 错误: ${summary.summary.error}`,
      '========================'
    ];

    return lines.join('\n');
  }

  // 检查是否应该发送告警
  shouldAlert() {
    const status = this.healthStatus.overall;
    return status === 'unhealthy' || status === 'error';
  }

  // 获取告警消息
  getAlertMessage() {
    if (!this.shouldAlert()) {
      return null;
    }

    const summary = this.getHealthSummary();
    const unhealthyComponents = summary.components.filter(
      c => c.status === 'unhealthy' || c.status === 'error'
    );

    const alertLines = [
      '🚨 系统健康检查告警',
      `整体状态: ${summary.status.toUpperCase()}`,
      '',
      '异常组件:',
      ...unhealthyComponents.map(comp => 
        `❌ ${comp.name}: ${comp.message}`
      )
    ];

    return alertLines.join('\n');
  }
}

export default HealthCheckManager;
export { HealthCheckManager };
