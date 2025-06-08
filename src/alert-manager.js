// 增强的告警系统
import TelegramBot from "node-telegram-bot-api";
import { createLogger } from "./logger.js";
import configManager from "./config.js";
import PerformanceMonitor from "./performance.js";

const logger = createLogger('ALERTS');

class AlertManager {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.bot = null;
    this.alertQueue = [];
    this.isProcessing = false;
    this.alertHistory = new Map(); // 用于防止重复告警
    this.init();
  }

  init() {
    const botToken = configManager.get('telegram.botToken');
    const chatId = configManager.get('telegram.chatId');
    const groupId = configManager.get('telegram.groupId');

    if (botToken && (chatId || groupId)) {
      this.bot = new TelegramBot(botToken);
      logger.info('Telegram 告警系统初始化成功');
    } else {
      logger.warn('Telegram 配置不完整，告警系统未启用');
    }
  }

  // 发送基础 Telegram 消息
  async sendTelegramMessage(message, target = 'chat') {
    if (!this.bot) {
      logger.warn('Telegram bot 未初始化，无法发送消息');
      return false;
    }

    const targetId = target === 'group' 
      ? configManager.get('telegram.groupId')
      : configManager.get('telegram.chatId');

    if (!targetId) {
      logger.warn(`未配置 Telegram ${target} ID`);
      return false;
    }

    // 过滤空内容
    if (!message || !String(message).trim()) {
      logger.warn('Telegram 消息内容为空，跳过发送');
      return false;
    }

    const maxLength = configManager.get('telegram.maxMessageLength');
    
    try {
      // 分割长消息
      if (typeof message === "string" && message.length > maxLength) {
        let start = 0;
        let part = 1;
        const results = [];
        
        while (start < message.length) {
          const chunk = message.slice(start, start + maxLength);
          try {
            await this.bot.sendMessage(targetId, chunk);
            logger.info(`Telegram ${target} 消息第 ${part} 部分发送成功`);
            results.push(true);
          } catch (error) {
            logger.error(`Telegram ${target} 消息第 ${part} 部分发送失败`, { error: error.message });
            results.push(false);
          }
          start += maxLength;
          part++;
          
          // 避免发送过快
          if (start < message.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        this.performanceMonitor.incrementCounter(`telegram.${target}.messages.sent`, results.length);
        this.performanceMonitor.incrementCounter(`telegram.${target}.messages.success`, results.filter(Boolean).length);
        return results.every(Boolean);
      } else {
        await this.bot.sendMessage(targetId, message);
        logger.info(`Telegram ${target} 消息发送成功`);
        this.performanceMonitor.incrementCounter(`telegram.${target}.messages.sent`);
        this.performanceMonitor.incrementCounter(`telegram.${target}.messages.success`);
        return true;
      }
    } catch (error) {
      logger.error(`Telegram ${target} 消息发送失败`, { 
        error: error.message, 
        code: error.code,
        messageLength: message.length 
      });
      this.performanceMonitor.incrementCounter(`telegram.${target}.messages.sent`);
      this.performanceMonitor.incrementCounter(`telegram.${target}.messages.failed`);
      return false;
    }
  }

  // 发送到聊天
  async sendToChat(message) {
    return this.sendTelegramMessage(message, 'chat');
  }

  // 发送到群组
  async sendToGroup(message) {
    return this.sendTelegramMessage(message, 'group');
  }

  // 创建告警消息
  createAlert(type, title, details = {}) {
    const alert = {
      id: Date.now() + Math.random(),
      type,
      title,
      details,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(type)
    };

    return alert;
  }

  getAlertSeverity(type) {
    const severityMap = {
      'system_error': 'critical',
      'database_failure': 'critical',
      'account_failure': 'high',
      'performance_degradation': 'medium',
      'configuration_issue': 'medium',
      'network_issue': 'medium',
      'warning': 'low',
      'info': 'low'
    };

    return severityMap[type] || 'medium';
  }

  // 格式化告警消息
  formatAlert(alert) {
    const severityEmojis = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🔵'
    };

    const emoji = severityEmojis[alert.severity] || '⚪';
    const timestamp = new Date(alert.timestamp).toLocaleString('zh-CN');
    
    let message = `${emoji} **${alert.title}**\n`;
    message += `⏰ 时间: ${timestamp}\n`;
    message += `📊 级别: ${alert.severity.toUpperCase()}\n`;
    
    if (Object.keys(alert.details).length > 0) {
      message += `\n**详细信息:**\n`;
      for (const [key, value] of Object.entries(alert.details)) {
        if (typeof value === 'object') {
          message += `• ${key}: ${JSON.stringify(value, null, 2)}\n`;
        } else {
          message += `• ${key}: ${value}\n`;
        }
      }
    }

    return message;
  }

  // 检查是否需要抑制重复告警
  shouldSuppressAlert(alert) {
    const alertKey = `${alert.type}_${alert.title}`;
    const lastAlert = this.alertHistory.get(alertKey);
    
    if (!lastAlert) {
      return false;
    }

    // 5分钟内的相同告警将被抑制
    const suppressionWindow = 5 * 60 * 1000; // 5分钟
    const timeSinceLastAlert = Date.now() - lastAlert.timestamp;
    
    return timeSinceLastAlert < suppressionWindow;
  }

  // 发送告警
  async sendAlert(alert, target = 'chat') {
    if (this.shouldSuppressAlert(alert)) {
      logger.debug(`告警被抑制: ${alert.title}`, { type: alert.type });
      this.performanceMonitor.incrementCounter('alerts.suppressed');
      return;
    }

    // 记录告警历史
    const alertKey = `${alert.type}_${alert.title}`;
    this.alertHistory.set(alertKey, { timestamp: Date.now() });

    const message = this.formatAlert(alert);
    const results = [];

    try {
      if (target === 'chat' || target === 'both') {
        const chatResult = await this.sendToChat(message);
        results.push({ target: 'chat', success: chatResult });
      }

      if (target === 'group' || target === 'both') {
        const groupResult = await this.sendToGroup(message);
        results.push({ target: 'group', success: groupResult });
      }

      const successCount = results.filter(r => r.success).length;
      
      if (successCount > 0) {
        logger.info(`告警发送成功: ${alert.title}`, { 
          severity: alert.severity,
          targets: results.length,
          successful: successCount
        });
        this.performanceMonitor.incrementCounter(`alerts.${alert.severity}.sent`);
      } else {
        logger.error(`告警发送失败: ${alert.title}`, { severity: alert.severity });
        this.performanceMonitor.incrementCounter(`alerts.${alert.severity}.failed`);
      }

      return results;
    } catch (error) {
      logger.error('发送告警时发生错误', { error: error.message, alert: alert.title });
      this.performanceMonitor.incrementCounter('alerts.errors');
      return [];
    }
  }

  // 系统相关告警方法
  async sendSystemError(title, error, additionalDetails = {}) {
    const alert = this.createAlert('system_error', title, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      ...additionalDetails
    });
    
    return this.sendAlert(alert);
  }

  // 账号错误告警方法（别名方法，兼容现有代码）
  async sendAccountError(username, error, operation = 'unknown') {
    return this.sendAccountFailure(username, error, operation);
  }

  async sendDatabaseFailure(databaseName, error, operation = 'unknown') {
    const alert = this.createAlert('database_failure', `数据库故障: ${databaseName}`, {
      database: databaseName,
      operation,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return this.sendAlert(alert);
  }  async sendAccountFailure(username, error, operation = 'unknown') {
    const alert = this.createAlert('account_failure', `账号操作失败: ${username}`, {
      account: username,
      operation,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // 账号失败信息只发送到私聊，不发送到群组
    return this.sendAlert(alert, 'chat');
  }
  // 账号状态更新方法
  async sendAccountUpdate(message, details = {}) {
    const alertType = details.status === 'success' ? 'info' : 'account_failure';
    const alert = this.createAlert(alertType, message, {
      ...details,
      timestamp: new Date().toISOString()
    });
    
    // 账号状态更新只发送到私聊，不发送到群组
    return this.sendAlert(alert, 'chat');
  }

  async sendPerformanceAlert(metric, value, threshold, details = {}) {
    const alert = this.createAlert('performance_degradation', `性能告警: ${metric}`, {
      metric,
      currentValue: value,
      threshold,
      ...details
    });
    
    return this.sendAlert(alert);
  }
  // 发送信息类消息（非告警）
  async sendInfo(title, details = {}, target = 'chat') {
    const alert = this.createAlert('info', title, details);
    return this.sendAlert(alert, target);
  }
  // 发送 RSS 内容到群组
  async sendRssContent(title, details = {}) {
    // 对于RSS内容，直接发送内容而不是作为告警格式
    if (details.content && typeof details.content === 'string') {
      const rssMessage = `📰 **${title}**\n⏰ ${new Date().toLocaleString('zh-CN')}\n\n${details.content}`;
      return this.sendToGroup(rssMessage);
    } else {
      // 如果没有内容字段，使用标准告警格式
      const alert = this.createAlert('info', title, details);
      return this.sendAlert(alert, 'group');
    }
  }

  // 发送成功消息
  async sendSuccess(title, details = {}, target = 'chat') {
    const message = `✅ **${title}**\n⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n`;
    let fullMessage = message;
    
    if (Object.keys(details).length > 0) {
      fullMessage += `\n**详细信息:**\n`;
      for (const [key, value] of Object.entries(details)) {
        fullMessage += `• ${key}: ${value}\n`;
      }
    }

    if (target === 'chat' || target === 'both') {
      await this.sendToChat(fullMessage);
    }
    
    if (target === 'group' || target === 'both') {
      await this.sendToGroup(fullMessage);
    }
  }

  // 定期清理告警历史
  cleanupAlertHistory() {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, value] of this.alertHistory.entries()) {
      if (now - value.timestamp > cleanupThreshold) {
        this.alertHistory.delete(key);
      }
    }
    
    logger.debug(`告警历史清理完成，剩余 ${this.alertHistory.size} 条记录`);
  }

  // 获取告警统计
  getAlertStats() {
    return {
      historySize: this.alertHistory.size,
      queueSize: this.alertQueue.length,
      botInitialized: !!this.bot,
      telegramConfigured: configManager.isFeatureEnabled('telegram')
    };
  }
}

// 创建全局告警管理器实例
const alertManager = new AlertManager();

// 定期清理告警历史（每小时）
setInterval(() => {
  alertManager.cleanupAlertHistory();
}, 60 * 60 * 1000);

export default alertManager;
export { AlertManager };
