/**
 * 代理配置模块
 * 支持HTTP、HTTPS、SOCKS代理
 */

// 代理配置类型枚举
export const ProxyTypes = {
  HTTP: 'http',
  HTTPS: 'https', 
  SOCKS4: 'socks4',
  SOCKS5: 'socks5'
};

/**
 * 解析代理URL
 * @param {string} proxyUrl - 代理URL (http://user:pass@host:port 或 socks5://user:pass@host:port)
 * @returns {Object} 解析后的代理配置
 */
export function parseProxyUrl(proxyUrl) {
  if (!proxyUrl) return null;
  
  try {
    const url = new URL(proxyUrl);
    const config = {
      type: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port),
    };
    
    if (url.username) {
      config.username = url.username;
    }
    if (url.password) {
      config.password = url.password;
    }
    
    return config;
  } catch (error) {
    console.error('代理URL解析错误:', error.message);
    return null;
  }
}

/**
 * 获取代理配置
 * @returns {Object|null} 代理配置对象
 */
export function getProxyConfig() {
  const proxyUrl = process.env.PROXY_URL;
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyType = process.env.PROXY_TYPE || 'http';
  const proxyUsername = process.env.PROXY_USERNAME;
  const proxyPassword = process.env.PROXY_PASSWORD;
  
  // 优先使用PROXY_URL
  if (proxyUrl) {
    return parseProxyUrl(proxyUrl);
  }
  
  // 使用分离的配置参数
  if (proxyHost && proxyPort) {
    const config = {
      type: proxyType,
      host: proxyHost,
      port: parseInt(proxyPort),
    };
    
    if (proxyUsername) {
      config.username = proxyUsername;
    }
    if (proxyPassword) {
      config.password = proxyPassword;
    }
    
    return config;
  }
  
  return null;
}

/**
 * 为Puppeteer生成代理配置
 * @param {Object} proxyConfig - 代理配置
 * @returns {Object} Puppeteer代理配置
 */
export function getPuppeteerProxyArgs(proxyConfig) {
  if (!proxyConfig) return [];
  
  const args = [];
  
  if (proxyConfig.type === 'http' || proxyConfig.type === 'https') {
    args.push(`--proxy-server=${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
  } else if (proxyConfig.type === 'socks4' || proxyConfig.type === 'socks5') {
    args.push(`--proxy-server=${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
  }
  
  return args;
}

/**
 * 为Playwright生成代理配置
 * @param {Object} proxyConfig - 代理配置
 * @returns {Object} Playwright代理配置
 */
export function getPlaywrightProxyConfig(proxyConfig) {
  if (!proxyConfig) return null;
  
  const config = {
    server: `${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`,
  };
  
  if (proxyConfig.username && proxyConfig.password) {
    config.username = proxyConfig.username;
    config.password = proxyConfig.password;
  }
  
  return config;
}

/**
 * 测试代理连接
 * @param {Object} proxyConfig - 代理配置
 * @returns {Promise<boolean>} 是否连接成功
 */
export async function testProxyConnection(proxyConfig) {
  if (!proxyConfig) return false;
  
  try {
    const { default: fetch } = await import('node-fetch');
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const { SocksProxyAgent } = await import('socks-proxy-agent');
    
    let agent;
    
    if (proxyConfig.type === 'http' || proxyConfig.type === 'https') {
      const proxyUrl = proxyConfig.username && proxyConfig.password
        ? `${proxyConfig.type}://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`
        : `${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`;
      agent = new HttpsProxyAgent(proxyUrl);
    } else if (proxyConfig.type === 'socks4' || proxyConfig.type === 'socks5') {
      const proxyUrl = proxyConfig.username && proxyConfig.password
        ? `${proxyConfig.type}://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`
        : `${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`;
      agent = new SocksProxyAgent(proxyUrl);
    }
    
    const response = await fetch('https://httpbin.org/ip', {
      agent,
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('代理测试成功，IP地址:', data.origin);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('代理测试失败:', error.message);
    return false;
  }
}

/**
 * 获取当前IP地址（不使用代理）
 */
export async function getCurrentIP() {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('https://httpbin.org/ip', { timeout: 10000 });
    if (response.ok) {
      const data = await response.json();
      return data.origin;
    }
  } catch (error) {
    console.error('获取IP地址失败:', error.message);
  }
  return null;
}

export default {
  ProxyTypes,
  parseProxyUrl,
  getProxyConfig,
  getPuppeteerProxyArgs,
  getPlaywrightProxyConfig,
  testProxyConnection,
  getCurrentIP
};
