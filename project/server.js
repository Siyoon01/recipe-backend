// 파일 경로: server.js (프로젝트 루트)

require('dotenv').config(); // 환경 변수 로드 (가장 먼저 실행)
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./src/config/database'); // DB 연결 및 테스트 실행

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (업로드된 이미지 파일)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 프론트엔드 빌드 파일 서빙 (정적 파일: CSS, JS, 이미지 등)
const frontendBuildPath = path.join(__dirname, '../recipe2/build');
app.use(express.static(frontendBuildPath));

// 데이터베이스 pool을 export (모델 파일에서 사용)
// 모델 파일들이 require('../../app')로 가져오므로 호환성을 위해 app도 export
module.exports = { app, pool };

// 라우트 설정
const userRoutes = require('./src/routes/user.routes');
const profileRoutes = require('./src/routes/profile.routes');
const recipeRoutes = require('./src/routes/recipe.routes');
const ingredientRoutes = require('./src/routes/ingredient.routes');
const imageRoutes = require('./src/routes/image.routes');
const adminRoutes = require('./src/routes/admin.routes');
const masterDataRoutes = require('./src/routes/masterData.routes');

// API 라우트 등록 (API 설계에 맞게 경로 설정)
app.use('/api/user', userRoutes); // /api/user/signup, /api/user/login, /api/user/profile 등
app.use('/api/profile', profileRoutes); // /api/profile/allergies, /api/profile/tools
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', masterDataRoutes); // /api/allergies, /api/tools

// 에러 핸들링 미들웨어 (선택사항)
app.use((err, req, res, next) => {
  console.error('에러 발생:', err);
  res.status(err.status || 500).json({
    success: false,
    result_code: err.status || 500,
    message: err.message || '서버 오류가 발생했습니다.'
  });
});

// SPA 라우팅 지원: API가 아닌 모든 요청은 프론트엔드 index.html로 리다이렉트
// 모든 라우트 등록 후 마지막에 배치해야 함
app.use((req, res, next) => {
  // API 요청은 제외하고 404 처리
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      result_code: 404,
      message: '요청한 리소스를 찾을 수 없습니다.'
    });
  }
  // 그 외 모든 요청은 프론트엔드 index.html로
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api`);
});

