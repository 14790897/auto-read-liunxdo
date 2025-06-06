import { Pool } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
if (fs.existsSync(".env.local")) {
  console.log("Using .env.local file to supply config environment variables");
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false }
});

async function debugDatabase() {
  try {
    // 检查最近的一些posts
    const res = await pool.query('SELECT guid, title, created_at FROM posts ORDER BY created_at DESC LIMIT 10');
    console.log('Recent posts in database:');
    res.rows.forEach(row => {
      console.log(`GUID: ${row.guid}, Title: ${row.title.substring(0, 50)}..., Created: ${row.created_at}`);
    });
    
    // 检查特定GUID是否存在
    const testGuids = [
      'https://linux.do/t/topic/298776',
      'https://linux.do/t/topic/298777',
      'https://linux.do/t/topic/298778'
    ];
    
    console.log('\nChecking specific GUIDs:');
    for (const guid of testGuids) {
      const check = await pool.query('SELECT COUNT(*) FROM posts WHERE guid = $1', [guid]);
      console.log(`GUID ${guid}: exists = ${check.rows[0].count > 0}`);
    }
    
    // 查看总记录数
    const countRes = await pool.query('SELECT COUNT(*) FROM posts');
    console.log(`\nTotal posts in database: ${countRes.rows[0].count}`);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();
