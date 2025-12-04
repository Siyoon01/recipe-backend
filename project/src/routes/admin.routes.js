// 파일 경로: src/routes/admin.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/admin.controller.js)
const {
    getAllUsers, 
    getUserDetailsById,
    updateUserById, 
    deleteUserById,
    updateRecipeById,
    deleteRecipeById,
    getUserStats,
    getIngredientStats,
    getRecipeStats
} = require('../controllers/admin.controller');

// 2. Middleware 함수 가져오기 (src/middleware/auth.middleware.js)
const { 
    authenticateToken, 
    isAdmin 
} = require('../middleware/auth.middleware');


// --- 모든 Admin 라우트에 인증 및 관리자 권한 미들웨어 적용 ---
// 요청은 반드시 로그인되어야 하고(authenticateToken), role이 'admin'이어야 합니다(isAdmin).
router.use(authenticateToken, isAdmin);


// --- 1. 사용자 관리 (Users) ---

// GET /admin/users (전체 사용자 목록 조회)
router.get('/users', getAllUsers);

// GET /admin/users/:id (특정 사용자 상세 정보 조회 - 알레르기/도구/식재료 포함)
router.get('/users/:id', getUserDetailsById);

// PUT /admin/users/:id (특정 사용자 정보 수정)
router.put('/users/:id', updateUserById);

// DELETE /admin/users/:id (특정 사용자 강제 탈퇴)
router.delete('/users/:id', deleteUserById);


// --- 2. 레시피 관리 (Recipes) ---

// PUT /admin/recipes/:id (레시피 전체 정보 수정 - 기본/재료/순서 일괄)
router.put('/recipes/:id', updateRecipeById);

// DELETE /admin/recipes/:id (레시피 삭제)
router.delete('/recipes/:id', deleteRecipeById);


// --- 3. 통계 조회 (Stats) ---

// GET /admin/stats/users (사용자 통계: 성비, 연령)
router.get('/stats/users', getUserStats);

// GET /admin/stats/ingredients (식재료 통계: 최다 등록)
router.get('/stats/ingredients', getIngredientStats);

// GET /admin/stats/recipes (레시피 통계: 최다 추천/조회)
router.get('/stats/recipes', getRecipeStats);


module.exports = router;