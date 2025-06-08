import { extractTopicIdFromUrl, processAndSaveTopicData } from './src/topic_data.js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
if (fs.existsSync(".env.local")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function testTopicData() {
  try {
    // Test URL extraction
    const testUrls = [
      'https://linux.do/t/topic/710103',
      'https://linux.do/t/topic/525305/100',
      'https://linux.do/t/topic/13716/790'
    ];
    
    console.log('测试话题ID提取:');
    for (const url of testUrls) {
      const topicId = extractTopicIdFromUrl(url);
      console.log(`URL: ${url} -> Topic ID: ${topicId}`);
    }
    
    // Test with an invalid URL
    const invalidUrl = 'https://linux.do/latest';
    const invalidTopicId = extractTopicIdFromUrl(invalidUrl);
    console.log(`Invalid URL: ${invalidUrl} -> Topic ID: ${invalidTopicId}`);
    
    console.log('\n✅ 话题ID提取测试完成');
    
    // Note: We're not testing the full processAndSaveTopicData function here
    // because it requires a Puppeteer page instance which is complex to set up
    console.log('\n📝 完整的话题数据抓取功能需要在实际运行环境中测试');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testTopicData();
