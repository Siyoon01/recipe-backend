// 파일 경로: src/config/database.js

const mysql = require('mysql2/promise');
require('dotenv').config();

// MariaDB 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'your_database_name',
  waitForConnections: true,
  connectionLimit: 10, // 최대 연결 수
  queueLimit: 0, // 대기 큐 제한 (0 = 무제한)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 연결 테스트 함수
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MariaDB 연결 성공');
    console.log(`📊 데이터베이스: ${process.env.DB_NAME || 'your_database_name'}`);
    console.log(`🔗 호스트: ${process.env.DB_HOST || 'localhost'}`);
    
    // 간단한 쿼리로 연결 확인
    const [rows] = await connection.query('SELECT 1 as test');
    if (rows && rows.length > 0) {
      console.log('✅ 데이터베이스 쿼리 테스트 성공');
    }
    
    connection.release();
  } catch (error) {
    console.error('❌ MariaDB 연결 실패:', error.message);
    console.error('💡 다음 사항을 확인해주세요:');
    console.error('   1. MariaDB 서버가 실행 중인지 확인');
    console.error('   2. .env 파일의 DB 설정이 올바른지 확인');
    console.error('   3. 데이터베이스가 생성되었는지 확인');
    process.exit(1); // 연결 실패 시 서버 시작 중단
  }
}

// 서버 시작 시 연결 테스트
testConnection();

module.exports = { pool };