import { parseRss } from './src/parse_rss.js';
import { isGuidExists } from './src/db.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
if (fs.existsSync(".env.local")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function debugRssAndGuids() {
  try {
    // 模拟获取RSS数据
    const response = await fetch('https://linux.do/latest.rss');
    const xmlData = await response.text();
    
    // 分析RSS原始结构
    const xml2js = await import('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const result = await parser.parseStringPromise(xmlData);
    const items = result.rss.channel.item;
    
    console.log('原始RSS数据分析:');
    console.log('Items数量:', Array.isArray(items) ? items.length : 1);
    
    if (Array.isArray(items)) {
      console.log('\n前3个items的GUID信息:');
      for (let i = 0; i < Math.min(3, items.length); i++) {
        const item = items[i];
        console.log(`Item ${i + 1}:`);
        console.log('  title:', item.title);
        console.log('  link:', item.link);
        console.log('  guid对象:', JSON.stringify(item.guid, null, 2));
        console.log('  guid._:', item.guid?._);
        console.log('  guid.isPermaLink:', item.guid?.$?.isPermaLink);
        
        // 检查这个GUID是否在数据库中存在
        const guid = item.guid?._|| item.guid;
        console.log('  提取的guid:', guid);
        
        if (guid) {
          const exists = await isGuidExists(guid);
          console.log('  数据库中存在:', exists);
        }
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugRssAndGuids();
