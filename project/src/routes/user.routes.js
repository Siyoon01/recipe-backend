// 파일 경로: src/routes/user.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/auth.controller.js)
const { 
    signupUser, 
    loginUser, 
    getUserProfile, 
    updateUserProfile,
    deleteUserProfile, 
    findUserId, 
    resetUserPassword,
    verifyResetIdentity // 비밀번호 재설정 1단계
} = require('../controllers/auth.controller');

// 2. Middleware 함수 가져오기 (src/middleware/auth.middleware.js)
const { authenticateToken } = require('../middleware/auth.middleware');


// --- 1. 공개(Public) 접근 API (인증 불필요) ---

// POST /api/user/signup (사용자 회원가입)
router.post('/signup', signupUser);

// POST /api/user/login (사용자 로그인)
router.post('/login', loginUser);

// POST /api/user/find-id (아이디 찾기 - 이름+생년월일)
router.post('/find-id', findUserId);

// POST /api/user/verify-reset-identity (비밀번호 재설정 1단계: 본인 확인)
router.post('/verify-reset-identity', verifyResetIdentity);

// POST /api/user/reset-password (비밀번호 재설정 2단계: 최종 처리)
// resetToken과 newPassword를 받아 처리
router.post('/reset-password', resetUserPassword);


// --- 2. 보호(Protected) 접근 API (인증 필수) ---

// GET /api/user/profile (사용자 정보 조회)
router.get('/profile', authenticateToken, getUserProfile);

// PUT /api/user/profile (사용자 정보 수정 - 비밀번호 확인 포함)
router.put('/profile', authenticateToken, updateUserProfile);

// DELETE /api/user/profile (회원탈퇴 - 비밀번호 확인 포함)
router.delete('/profile', authenticateToken, deleteUserProfile);


module.exports = router;