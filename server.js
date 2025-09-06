// 메인 서버 파일
const app = require('./app');

const PORT = process.env.PORT || 3001;

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행중입니다!`);
  console.log(`📝 API 테스트: http://localhost:${PORT}`);
  console.log(`🔐 회원가입: POST http://localhost:${PORT}/api/signup`);
  console.log(`🔑 로그인: POST http://localhost:${PORT}/api/login`);
});