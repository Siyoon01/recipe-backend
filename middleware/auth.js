// JWT 인증 미들웨어
const jwt = require('jsonwebtoken');

// JWT 시크릿 키 (환경변수에서 가져오거나 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  // Authorization 헤더에서 토큰 추출
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '액세스 토큰이 필요합니다.'
    });
  }

  // 토큰 검증
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    // 검증된 사용자 정보를 req 객체에 추가
    req.user = user;
    next();
  });
};

// 토큰 생성 함수
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      userID: user.userID,
      nickname: user.nickname 
    },
    JWT_SECRET,
    { expiresIn: '24h' } // 24시간 후 만료
  );
};

module.exports = {
  authenticateToken,
  generateToken
};
