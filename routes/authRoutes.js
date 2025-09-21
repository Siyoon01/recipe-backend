// 인증 관련 라우트
const express = require('express');
const router = express.Router();
const { signup, login, getProfile, updateProfile, updateDetailInfo, getDetailInfo } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// 회원가입 API
// POST /api/signup
router.post('/signup', signup);

// 로그인 API
// POST /api/login
router.post('/login', login);

// 사용자 프로필 조회 API (보호된 라우트)
// GET /api/profile
router.get('/profile', authenticateToken, getProfile);

// 사용자 프로필 수정 API (보호된 라우트)
// PUT /api/profile
router.put('/profile', authenticateToken, updateProfile);

// 사용자 상세 정보 수정 API (보호된 라우트)
// PUT /api/user/detailinfo
router.put('/user/detailinfo', authenticateToken, updateDetailInfo);

// 사용자 상세 정보 조회 API (보호된 라우트)
// GET /api/user/detailinfo
router.get('/user/detailinfo', authenticateToken, getDetailInfo);

module.exports = router;
