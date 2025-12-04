// 파일 경로: src/routes/image.routes.js

const express = require('express');
const router = express.Router();

// 1. Controller 함수들 가져오기 (src/controllers/image.controller.js)
const { 
    uploadImage, 
    getImageAnalysisResult 
} = require('../controllers/image.controller');

// 2. Middleware 함수 가져오기
const { authenticateToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware'); // Multer 설정이 담긴 파일


// --- 이미지 분석 API ---

/**
 * @route   POST /api/images/upload
 * @desc    식재료 이미지 파일 업로드 및 분석 요청 기록
 * @access  Private (로그인 필수)
 * NOTE: 'image'는 클라이언트가 파일을 전송할 때 사용하는 필드명입니다.
 */
router.post(
    '/upload', 
    authenticateToken, 
    upload.single('image'), // 1. 인증 확인 -> 2. 파일 저장(multer) -> 3. DB 기록(Controller)
    uploadImage
);

/**
 * @route   GET /api/images/analysis/:id
 * @desc    이미지 분석 진행 상태 및 결과 조회 (Polling)
 * @access  Private (로그인 필수)
 */
router.get(
    '/analysis/:id', 
    authenticateToken, 
    getImageAnalysisResult
);


module.exports = router;