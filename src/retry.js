import { systemLogger } from './logger.js';

// 重试配置
const RetryConfig = {
  // 数据库操作重试
  DATABASE: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  // 网络请求重试
  NETWORK: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 1.5
  },
  // 浏览器操作重试
  BROWSER: {
    maxRetries: 2,
    baseDelay: 5000,
    maxDelay: 15000,
    backoffMultiplier: 2
  }
};

class RetryManager {
  static async withRetry(operation, config, context = '') {
    const { maxRetries, baseDelay, maxDelay, backoffMultiplier } = config;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;
          if (attempt > 1) {
          systemLogger.info(`重试成功: ${context}`, {
            attempt,
            duration,
            totalAttempts: maxRetries + 1
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt <= maxRetries) {
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt - 1),
            maxDelay
          );
            systemLogger.warn(`重试操作: ${context}`, {
            attempt,
            policy: this.getRetryPolicyName(config),
            error: error.message,
            nextRetryIn: `${delay}ms`
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }    systemLogger.error(`重试失败，已达到最大重试次数: ${context}`, {
      maxRetries,
      finalError: lastError.message
    });
    
  throw lastError;
  }

  // 获取重试策略名称
  static getRetryPolicyName(config) {
    if (config === RetryConfig.DATABASE) return 'database';
    if (config === RetryConfig.NETWORK) return 'network';
    if (config === RetryConfig.BROWSER) return 'browser';
    return 'custom';
  }

  // 数据库操作重试
  static async database(operation, context = '') {
    return this.withRetry(operation, RetryConfig.DATABASE, `数据库操作: ${context}`);
  }

  // 网络请求重试
  static async network(operation, context = '') {
    return this.withRetry(operation, RetryConfig.NETWORK, `网络请求: ${context}`);
  }

  // 浏览器操作重试
  static async browser(operation, context = '') {
    return this.withRetry(operation, RetryConfig.BROWSER, `浏览器操作: ${context}`);
  }

  // 条件重试 - 只有特定错误才重试
  static async conditional(operation, shouldRetry, config, context = '') {
    const { maxRetries, baseDelay, maxDelay, backoffMultiplier } = config;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          systemLogger.info(`条件重试成功 ${context}`, { attempt });
        }
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt <= maxRetries && shouldRetry(error)) {
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt - 1),
            maxDelay
          );
          
          systemLogger.warn(`条件重试 ${context}`, {
            attempt,
            error: error.message,
            nextRetryIn: `${delay}ms`
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }
}

// 常用的错误判断函数
export const ErrorCheckers = {
  isNetworkError: (error) => {
    const networkErrors = [
      'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT',
      'TimeoutError', 'Navigation timeout', 'net::ERR'
    ];
    return networkErrors.some(err => error.message.includes(err));
  },

  isDatabaseError: (error) => {
    const dbErrors = [
      'connection terminated', 'Connection refused', 'ECONNRESET',
      'timeout', 'ENOTFOUND'
    ];
    return dbErrors.some(err => error.message.includes(err));
  },

  isCloudflareError: (error) => {
    const cfErrors = [
      'Just a moment', 'Cloudflare', 'status of 429', 'rate limit'
    ];
    return cfErrors.some(err => error.message.includes(err));
  },

  isLoginError: (error) => {
    const loginErrors = [
      'incorrect', 'Incorrect', '不正确', '登录失败'
    ];
    return loginErrors.some(err => error.message.includes(err));  }
};

// 策略化重试函数 - 更简洁的API
export async function retryWithPolicy(operation, policyType = 'database', options = {}) {
  const config = RetryConfig[policyType.toUpperCase()] || RetryConfig.DATABASE;
  const { context, onRetry } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        systemLogger.info(`重试成功 ${context || ''}`, { attempt, policy: policyType });
      }
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt <= config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        // 添加随机抖动减少雷群效应
        const jitter = Math.random() * 0.1 * delay;
        const actualDelay = delay + jitter;
        
        systemLogger.warn(`重试操作 ${context || ''}`, {
          attempt,
          policy: policyType,
          error: error.message,
          nextRetryIn: `${Math.round(actualDelay)}ms`
        });
        
        // 调用重试回调
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      } else {
        break;
      }
    }
  }  throw lastError;
}

export default RetryManager;
export { RetryConfig };
