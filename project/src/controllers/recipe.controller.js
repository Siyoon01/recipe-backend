// 파일 경로: src/controllers/recipe.controller.js

const { RecipeRepository } = require('../models/Recipe.model');
const { IngredientRepository } = require('../models/Ingredient.model');
const { RecipeViewLogRepository } = require('../models/RecipeViewLog.model');
const { RecommendationLogRepository } = require('../models/RecommendationLog.model');
const { AllergyRepository } = require('../models/Allergy.model');
const { ToolRepository } = require('../models/Tool.model');
const { normalizeErrorCode } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// AI 서버 통신 서비스 (실제 AI 호출 및 데이터 조합은 여기서 이루어짐)
const aiService = require('../services/ai.service'); 

// --- POST /api/recipes/recommend (맞춤 레시피 추천) ---
/**
 * 사용자의 검색 조건과 보유 재료를 조합하여 AI 기반 추천 결과를 반환합니다.
 */
const getRecommendedRecipes = async (req, res) => {
    try {
        const userId = req.user.id;
        const { query, requireMain } = req.body; 

        const ingredients = query?.selectedIngredientsIds?.join(', ') || '';
        const theme = query?.queryText || '';
        logger.info(`[User:${userId}]`, `GET /api/recipes/recommend 요청 수신 (ingredients: ${ingredients}, theme: ${theme})`);

        // 필수 파라미터 검증
        if (!query || !query.queryText || !query.selectedIngredientsIds) {
            logger.warn(`[User:${userId}]`, 'GET /api/recipes/recommend - 필수 검색 조건 누락');
            return res.status(400).json({
                success: false,
                result_code: 400,
                message: '필수 검색 조건이 누락되었습니다.'
            });
        }
        
        // 1. 사용자 정보 수집 (알레르기, 조리도구, 보유 식재료)
        const [userAllergies, userTools, ownedIngredientMasterIds] = await Promise.all([
            AllergyRepository.findByUserId(userId),
            ToolRepository.findByUserId(userId),
            IngredientRepository.getOwnedIngredientMasterIds(userId)
        ]);
        
        const userAllergyIds = userAllergies.map(a => a.id);
        const userToolIds = userTools.map(t => t.id);
        
        // 2. 1단계 필터링: 알레르기와 조리도구로 레시피 필터링
        // 2단계 필터링: requireMain이 true면 주재료가 사용자 식재료 목록에 있는지 확인
        const candidates = await RecipeRepository.filterRecipesForRecommendation(
            userAllergyIds,
            userToolIds,
            ownedIngredientMasterIds,
            requireMain || false,
            query.queryText
        );
        
        if (candidates.length === 0) {
            logger.info(`[User:${userId}]`, 'GET /api/recipes/recommend - 필터링 결과 없음');
            return res.status(200).json({
                success: true,
                result_code: 200,
                message: '맞춤 레시피 추천 성공',
                data: [] // 필터링 결과가 없으면 빈 배열 반환
            });
        }
        
        // 3. AI 서버 호출
        let aiResponse;
        try {
            aiResponse = await aiService.requestRecipeRecommendation({
                userId: userId,
                ownedIngredientIds: ownedIngredientMasterIds,
                query: {
                    queryText: query.queryText,
                    selectedIngredientIds: query.selectedIngredientsIds
                },
                requireMain: requireMain || false,
                candidates: candidates
            });
        } catch (error) {
            // AI 서버 통신 실패 처리
            logger.error(`[User:${userId}]`, `POST /api/recipes/recommend - AI 서버 통신 실패: ${error.message}`);
            const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
            return res.status(errorCode).json({
                success: false,
                result_code: errorCode,
                message: error.message || '레시피 추천 중 오류가 발생했습니다.'
            });
        }

        // 4. AI 결과를 기반으로 DB에서 레시피 상세 정보 조회 및 목록 구성
        const recommendedRecipeIds = aiResponse.recommendations.map(r => r.recipeId);
        
        if (recommendedRecipeIds.length === 0) {
            logger.info(`[User:${userId}]`, 'GET /api/recipes/recommend - 추천 결과 없음');
            return res.status(200).json({
                success: true,
                result_code: 200,
                message: '맞춤 레시피 추천 성공',
                data: []
            });
        }
        
        // 5. 레시피 상세 정보 조회
        const recommendedRecipes = await RecipeRepository.getRecipesByIds(recommendedRecipeIds);
        
        // 6. Response 형식 변환: required_ingredients를 문자열 배열로 변환
        const formattedRecipes = recommendedRecipes.map(recipe => ({
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            required_ingredients: recipe.required_ingredients.map(ing => ing.name),
            main_image_url: recipe.main_image_url
        }));

        // 7. 추천 로그 기록 (통계 관리를 위해)
        await RecommendationLogRepository.createBulkLog(userId, recommendedRecipeIds);

        logger.info(`[User:${userId}]`, `레시피 ${formattedRecipes.length}건 추천 완료 (IDs: ${recommendedRecipeIds.join(', ')})`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '맞춤 레시피 추천 성공',
            data: formattedRecipes
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `레시피 추천 처리 중 오류: ${error.message}`);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '서버 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/recipes (전체 레시피 목록 조회 / 검색) ---
/**
 * 전체 레시피 목록을 키워드 검색 기준으로 조회합니다. (인증 불필요)
 */
const getRecipes = async (req, res) => {
    const userId = req.user?.id || 'anonymous';
    try {
        const { keyword } = req.query; 
        logger.info(`[User:${userId}]`, `GET /api/recipes 요청 수신 (keyword: ${keyword || '없음'})`);

        // Model에서 검색 쿼리 실행
        const recipes = await RecipeRepository.searchRecipes(keyword);

        logger.info(`[User:${userId}]`, `레시피 ${recipes.length}건 조회 완료`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '검색 레시피 목록 조회 성공',
            data: recipes
        });
    } catch (error) {
        logger.error(`[User:${userId}]`, `레시피 목록 조회 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '레시피 목록 조회 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/recipes/popular (인기 레시피 조회) ---
/**
 * view_count가 가장 높은 상위 10개의 레시피를 조회합니다. (인증 불필요)
 */
const getPopularRecipes = async (req, res) => {
    const userId = req.user?.id || 'anonymous';
    try {
        logger.info(`[User:${userId}]`, 'GET /api/recipes/popular 요청 수신');
        // Model에서 view_count 기준으로 상위 10개 조회
        const popularRecipes = await RecipeRepository.findTopViewedRecipes(10); 

        logger.info(`[User:${userId}]`, `인기 레시피 ${popularRecipes.length}건 조회 완료`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '인기 레시피 목록입니다.',
            data: popularRecipes
        });
    } catch (error) {
        logger.error(`[User:${userId}]`, `인기 레시피 목록 조회 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '인기 레시피 목록 조회 중 오류가 발생했습니다.'
        });
    }
};


// --- GET /api/recipes/history (조회 기록 조회) ---
/**
 * 사용자가 최근 본 레시피 목록을 조회합니다.
 */
const getRecipeHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        logger.info(`[User:${userId}]`, 'GET /api/recipes/history 요청 수신');
        
        // Model에서 사용자의 조회 기록을 기반으로 레시피 목록 조회
        const historyRecipes = await RecipeRepository.findHistoryByUserId(userId); 

        logger.info(`[User:${userId}]`, `최근 본 레시피 ${historyRecipes.length}건 조회 완료`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '최근 본 레시피 목록입니다.',
            data: historyRecipes // Array of enriched recipe objects
        });
    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `레시피 조회 기록 불러오기 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '레시피 조회 기록을 불러오는 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/recipes/:id (레시피 상세 조회) ---
/**
 * 특정 레시피의 상세 정보를 조회합니다. (인증 불필요)
 */
const getRecipeById = async (req, res) => {
    try {
        const recipeId = parseInt(req.params.id, 10);

        const recipeDetails = await RecipeRepository.findById(recipeId);

        if (!recipeDetails) {
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '해당 ID의 레시피를 찾을 수 없습니다.'
            });
        }

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '레시피 상세 조회 성공',
            data: recipeDetails // Enriched object containing steps, ingredients, etc.
        });
    } catch (error) {
        logger.error('[Req:unknown]', `레시피 상세 조회 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '레시피 상세 조회 중 오류가 발생했습니다.'
        });
    }
};

// --- POST /api/recipes/:id/view (조회 기록 저장) ---
/**
 * 사용자가 레시피를 조회했음을 기록하고 조회수를 증가시킵니다.
 */
const createRecipeViewLog = async (req, res) => {
    try {
        const userId = req.user.id;
        const recipeId = parseInt(req.params.id, 10);
        
        // 1. 조회 기록 로그 테이블에 기록
        await RecipeViewLogRepository.createLog(userId, recipeId);
        
        // 2. 레시피의 전체 조회수 카운트를 증가
        await RecipeRepository.incrementViewCount(recipeId);

        res.status(201).json({
            success: true,
            result_code: 201, // 201 Created
            message: '조회 기록이 저장되었습니다.'
        });

    } catch (error) {
        console.error('createRecipeViewLog 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '조회 기록 저장 중 오류가 발생했습니다.'
        });
    }
};

module.exports = {
    getRecommendedRecipes, 
    getRecipes, 
    getPopularRecipes, 
    getRecipeHistory, 
    getRecipeById, 
    createRecipeViewLog
};