// 파일 경로: src/routes/profile.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/user.controller.js)
const { 
    getUserAllergies, 
    updateUserAllergies,
    getUserTools,
    updateUserTools
} = require('../controllers/user.controller');

// 2. Middleware 함수 가져오기 (src/middleware/auth.middleware.js)
const { authenticateToken } = require('../middleware/auth.middleware');


// --- 모든 프로필 설정 라우트에 인증 미들웨어 적용 ---
router.use(authenticateToken);


// --- 1. 알레르기 관리 (Allergy) ---

/**
 * @route   GET /api/profile/allergies
 * @desc    사용자가 등록한 알레르기 목록 조회
 * @access  Private (인증 필수)
 */
router.get('/allergies', getUserAllergies);

/**
 * @route   PUT /api/profile/allergies
 * @desc    사용자의 알레르기 목록 수정/덮어쓰기
 * @access  Private (인증 필수)
 */
router.put('/allergies', updateUserAllergies);


// --- 2. 조리도구 관리 (Tool) ---

/**
 * @route   GET /api/profile/tools
 * @desc    사용자가 등록한 조리도구 목록 조회
 * @access  Private (인증 필수)
 */
router.get('/tools', getUserTools);

/**
 * @route   PUT /api/profile/tools
 * @desc    사용자의 조리도구 목록 수정/덮어쓰기
 * @access  Private (인증 필수)
 */
router.put('/tools', updateUserTools);


module.exports = router;

