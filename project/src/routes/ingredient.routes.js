// 파일 경로: src/routes/ingredient.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/ingredient.controller.js)
const {
    createIngredient,
    createIngredientsBulk,
    getUserIngredients,
    updateIngredient,
    deleteIngredient,
    consumeIngredients,
    getExpiringIngredients
} = require('../controllers/ingredient.controller');

// 2. Middleware 함수 가져오기 (src/middleware/auth.middleware.js)
const { authenticateToken } = require('../middleware/auth.middleware');


// --- 모든 식재료 라우트에 인증 미들웨어 적용 ---
router.use(authenticateToken);


// POST /api/ingredients (식재료 1건 등록 - 수동 입력)
router.post('/', createIngredient);

// POST /api/ingredients/bulk (식재료 일괄 등록 - AI 분석 후)
router.post('/bulk', createIngredientsBulk);

// POST /api/ingredients/consume (식재료 일괄 차감 - 요리 후)
router.post('/consume', consumeIngredients);

// GET /api/ingredients (내 식재료 목록 조회)
router.get('/', getUserIngredients);

// GET /api/ingredients/expiring (소비기한 임박 식재료 조회 - 3일 이내)
router.get('/expiring', getExpiringIngredients);

// PUT /api/ingredients/:id (식재료 1건 수정)
router.put('/:id', updateIngredient);

// DELETE /api/ingredients/:id (식재료 1건 삭제)
router.delete('/:id', deleteIngredient);


module.exports = router;