// 인증 관련 라우트
const express = require('express');
const router = express.Router();
const { signup, login, getProfile, updateProfile } = require('../controllers/authController');
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

module.exports = router;
