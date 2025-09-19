// 식재료 관련 라우트
const express = require('express');
const router = express.Router();
const { createIngredient, getUserIngredients, updateIngredient, deleteIngredient } = require('../controllers/ingredientController');
const { authenticateToken } = require('../middleware/auth');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 식재료 등록 API
// POST /api/ingredients
router.post('/', createIngredient);

// 사용자별 식재료 조회 API
// GET /api/ingredients
router.get('/', getUserIngredients);

// 식재료 수정 API
// PUT /api/ingredients/:id
router.put('/:id', updateIngredient);

// 식재료 삭제 API
// DELETE /api/ingredients/:id
router.delete('/:id', deleteIngredient);

module.exports = router;
