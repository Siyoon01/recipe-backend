// 파일 경로: src/services/ai.service.js
// AI 서비스 (비즈니스 로직 및 인터페이스 레이어)

const aiProcess = require('../workers/aiProcess');
const logger = require('../utils/logger');

/**
 * 이미지 분석 요청
 * @param {number} userId - 사용자 ID
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {Promise<Object>} AI 서버 응답 { success, message, result_code, detections }
 */
async function requestImageAnalysis(userId, imagePath) {
  try {
    logger.info('[AI:cv]', `이미지 분석 요청: userId=${userId}, imagePath=${imagePath}`);
    
    // aiProcess를 통해 자식 프로세스 실행
    const result = await aiProcess.runImageAnalysis(userId, imagePath);
    
    // statusCode를 result_code로 변환 (기존 API 스펙과 호환)
    if (result.statusCode && !result.result_code) {
      result.result_code = result.statusCode;
    }
    
    logger.info('[AI:cv]', '이미지 분석 완료');
    return result;
  } catch (error) {
    logger.error('[AI:cv]', `이미지 분석 요청 실패: ${error.message}`);
    throw {
      message: error.message || '이미지 분석 중 오류가 발생했습니다.',
      code: error.code || 500
    };
  }
}

/**
 * 레시피 추천 요청
 * @param {Object} params - 추천 요청 파라미터
 * @param {number} params.userId - 사용자 ID
 * @param {Array<number>} params.ownedIngredientIds - 보유 식재료 마스터 ID 배열
 * @param {Object} params.query - 검색 쿼리
 * @param {string} params.query.queryText - 검색 텍스트
 * @param {Array<number>} params.query.selectedIngredientIds - 선택된 식재료 마스터 ID 배열
 * @param {boolean} params.requireMain - 주재료 필수 여부
 * @param {Array<Object>} params.candidates - 필터링된 레시피 후보 배열 [{ recipeId, ingredientIds }]
 * @returns {Promise<Object>} AI 서버 응답 { success, message, result_code, recommendations }
 */
async function requestRecipeRecommendation(params) {
  try {
    logger.info('[AI:recsys]', `레시피 추천 요청: userId=${params.userId}`);
    
    // aiProcess를 통해 자식 프로세스 실행
    const result = await aiProcess.runRecipeRecommendation(params);
    
    logger.info('[AI:recsys]', '레시피 추천 완료');
    return result;
  } catch (error) {
    logger.error('[AI:recsys]', `레시피 추천 요청 실패: ${error.message}`);
    throw {
      message: error.message || '레시피 추천 중 오류가 발생했습니다.',
      code: error.code || 500
    };
  }
}

module.exports = {
  requestImageAnalysis,
  requestRecipeRecommendation
};

