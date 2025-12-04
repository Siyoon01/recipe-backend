// 파일 경로: src/routes/masterData.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/masterData.controller.js)
const {
    getAllAllergies,
    getAllTools
} = require('../controllers/masterData.controller');


// --- 공통 마스터 데이터 API (인증 불필요) ---

/**
 * @route   GET /api/allergies
 * @desc    전체 알레르기 종류 목록 조회 (회원가입/수정 폼 사용)
 * @access  Public
 */
router.get('/allergies', getAllAllergies);

/**
 * @route   GET /api/tools
 * @desc    전체 조리도구 종류 목록 조회 (회원가입/수정 폼 사용)
 * @access  Public
 */
router.get('/tools', getAllTools);


module.exports = router;