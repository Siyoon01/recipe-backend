const express = require('express');
const router = express.Router();
const { updateUserAllergies, updateUserTools, getUserAllergies, getUserTools } = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

// 모든 프로필 관련 라우트에는 인증이 필요
router.use(authenticateToken);

// 사용자의 알레르기 정보 업데이트 API
// PUT /api/profile/allergies
router.put('/allergies', updateUserAllergies);

// 사용자의 알레르기 정보 조회 API
// GET /api/profile/allergies
router.get('/allergies', getUserAllergies);

// 사용자의 조리도구 정보 업데이트 API
// PUT /api/profile/tools
router.put('/tools', updateUserTools);

// 사용자의 조리도구 정보 조회 API
// GET /api/profile/tools
router.get('/tools', getUserTools);


module.exports = router;