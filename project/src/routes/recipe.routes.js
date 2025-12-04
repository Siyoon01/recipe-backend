// 파일 경로: src/routes/recipe.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/recipe.controller.js)
const {
    getRecommendedRecipes, 
    getRecipes, 
    getPopularRecipes, 
    getRecipeHistory, 
    getRecipeById, 
    createRecipeViewLog
} = require('../controllers/recipe.controller');

// 2. Middleware 함수 가져오기 (src/middleware/auth.middleware.js)
const { authenticateToken } = require('../middleware/auth.middleware');


// --- 1. 추천/검색/목록 조회 API (Public/Private) ---

/**
 * @route   POST /api/recipes/recommend
 * @desc    사용자 검색 조건 기반 맞춤 레시피 추천 (복잡한 JSON Body 처리 위해 POST 사용)
 * @access  Private (로그인 필요)
 */
router.post('/recommend', authenticateToken, getRecommendedRecipes);

/**
 * @route   GET /api/recipes
 * @desc    전체 레시피 목록 조회 및 키워드 검색
 * @access  Public (인증 불필요)
 */
router.get('/', getRecipes);

/**
 * @route   GET /api/recipes/popular
 * @desc    메인 화면용 인기/기본 추천 레시피 목록 조회
 * @access  Public (인증 불필요)
 */
router.get('/popular', getPopularRecipes);


// --- 2. 상세 정보 및 기록 API (ID 파라미터 사용) ---

/**
 * @route   GET /api/recipes/history
 * @desc    내가 본 레시피 기록 목록 조회
 * @access  Private (로그인 필요)
 */
router.get('/history', authenticateToken, getRecipeHistory);

/**
 * @route   GET /api/recipes/:id
 * @desc    레시피 1건 상세 정보 조회 (조리 순서, 재료 포함)
 * @access  Public (인증 불필요)
 */
router.get('/:id', getRecipeById);

/**
 * @route   POST /api/recipes/:id/view
 * @desc    레시피 상세 조회 기록 저장 (조회수 증가 및 기록 로그)
 * @access  Private (로그인 필요)
 */
router.post('/:id/view', authenticateToken, createRecipeViewLog);


module.exports = router;