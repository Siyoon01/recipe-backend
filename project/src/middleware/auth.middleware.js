// 파일 경로: src/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');

// 환경 변수에서 JWT 비밀 키를 가져옵니다.
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// --- 1. 사용자 인증 미들웨어 (authenticateToken) ---
/**
 * 요청 헤더의 JWT 토큰을 검증하고 사용자 정보를 req.user에 추가합니다.
 * @returns 401 (토큰 없음) 또는 403 (토큰 유효하지 않음)
 */
const authenticateToken = (req, res, next) => {
    // Authorization 헤더에서 토큰 추출 (예: Bearer TOKEN)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // 토큰이 없는 경우 (인증 정보 누락)
        return res.status(401).json({
            success: false,
            result_code: 401,
            message: '인증 정보(토큰)가 누락되었습니다. 다시 로그인해주세요.'
        });
    }

    // 토큰 검증
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // 토큰이 유효하지 않거나(만료/변조) 잘못된 경우
            return res.status(403).json({
                success: false,
                result_code: 403,
                message: '토큰이 유효하지 않습니다. 다시 로그인해주세요.'
            });
        }

        // 검증된 사용자 정보(id, userId, role 등)를 req 객체에 추가
        req.user = user;
        next(); // 다음 미들웨어 또는 컨트롤러로 이동
    });
};


// --- 2. 관리자 권한 확인 미들웨어 (isAdmin) ---
/**
 * authenticateToken을 통과한 사용자 중 role이 'admin'인지 확인합니다.
 * @returns 403 (권한 없음)
 */
const isAdmin = (req, res, next) => {
    // authenticateToken이 실행된 후 req.user에 사용자 정보가 있어야 합니다.
    if (req.user && req.user.role === 'admin') {
        next(); // 관리자 권한 확인 완료
    } else {
        // 권한이 없거나, 토큰에 role 정보가 'admin'이 아닌 경우
        return res.status(403).json({
            success: false,
            result_code: 403,
            message: '접근 권한이 없습니다. 관리자 계정만 접근 가능합니다.'
        });
    }
};


module.exports = {
    authenticateToken,
    isAdmin,
};