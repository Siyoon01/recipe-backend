// Express 앱 설정
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 데이터베이스 및 모델 가져오기
const { testConnection } = require('./config/database');
const { UserRepository } = require('./models/User');

// 라우트 가져오기
const authRoutes = require('./routes/authRoutes');

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(cors({
  origin: 'http://localhost:3000', // 프론트엔드 주소
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    // 데이터베이스 연결 테스트
    const isConnected = await testConnection();
    if (isConnected) {
      // users 테이블 생성
      await UserRepository.createTable();
    }
  } catch (error) {
    console.error('데이터베이스 초기화 실패:', error.message);
  }
};

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'Recipe Backend API 서버가 정상적으로 작동중입니다!',
    status: 'success',
    database: 'MySQL 연동',
    endpoints: {
      signup: 'POST /api/signup',
      login: 'POST /api/login'
    }
  });
});

// API 라우트 설정
app.use('/api', authRoutes);

// 404 에러 처리
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 API를 찾을 수 없습니다.'
  });
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.'
  });
});

// 데이터베이스 초기화 실행
initializeDatabase();

module.exports = app;
