// 인증 관련 라우트
const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');

// 회원가입 API
// POST /api/signup
router.post('/signup', signup);

// 로그인 API
// POST /api/login
router.post('/login', login);

module.exports = router;
