// 파일 경로: src/controllers/ingredient.controller.js

const { IngredientRepository } = require('../models/Ingredient.model');
const { normalizeErrorCode } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// --- 헬퍼 함수: 입력값 기본 검증 ---
/**
 * 식재료 등록 및 수정 시 필요한 필수 필드와 형식을 검증합니다.
 */
const validateIngredientInput = (data) => {
    const { name, expiryDate, quantity_value, quantity_unit } = data;
    
    if (!name || !expiryDate || quantity_value === undefined || !quantity_unit) {
        const error = new Error('식재료 이름, 소비기한, 수량, 단위를 모두 입력해주세요.');
        error.code = 400; // 400 Bad Request
        throw error;
    }
    // 날짜 형식 검증 (YYYY-MM-DD 형식으로 가정한 간단한 검증)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiryDate)) {
        const error = new Error('소비기한은 YYYY-MM-DD 형식으로 입력해주세요.');
        error.code = 400; // 400 Bad Request
        throw error;
    }
};

// --- POST /api/ingredients (식재료 1건 등록) ---
/**
 * 식재료 1건을 수동으로 등록합니다.
 */
const createIngredient = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 입력값 검증 (400 Bad Request 처리)
        validateIngredientInput(req.body);

        // 식재료 생성
        const newIngredient = await IngredientRepository.create(userId, req.body);

        res.status(201).json({
            success: true,
            result_code: 201, // 201 Created
            message: '식재료가 등록되었습니다.',
            data: newIngredient.toJSON() // user_id 포함된 상세 정보 반환
        });

    } catch (error) {
        console.error('createIngredient 오류:', error);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '식재료 등록 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- POST /api/ingredients/bulk (식재료 일괄 등록 - AI 분석 후) ---
/**
 * AI 분석 등으로 얻은 여러 식재료를 한 번에 등록합니다.
 */
const createIngredientsBulk = async (req, res) => {
    try {
        const userId = req.user.id;
        const { ingredients } = req.body; // Array of ingredient objects

        logger.info(`[User:${userId}]`, `POST /api/ingredients/bulk 요청 수신 (${ingredients?.length || 0}건)`);

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            logger.warn(`[User:${userId}]`, 'POST /api/ingredients/bulk - 등록할 식재료 목록이 유효하지 않음');
             return res.status(400).json({
                success: false,
                result_code: 400,
                message: "등록할 식재료 목록이 유효하지 않습니다."
            });
        }
        
        // 배열 내 각 항목 검증
        ingredients.forEach(item => validateIngredientInput(item));

        // Model에 일괄 등록 위임
        const count = await IngredientRepository.createBulk(userId, ingredients); 

        logger.info(`[User:${userId}]`, `${count}개의 식재료가 성공적으로 등록되었습니다.`);
        res.status(201).json({
            success: true,
            result_code: 201,
            message: `${count}개의 식재료가 성공적으로 등록되었습니다.`
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `식재료 일괄 등록 처리 중 오류: ${error.message}`);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '식재료 일괄 등록 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/ingredients (내 식재료 목록 조회) ---
/**
 * 로그인된 사용자의 모든 보유 식재료 목록을 조회합니다.
 */
const getUserIngredients = async (req, res) => {
    try {
        const userId = req.user.id;

        logger.info(`[User:${userId}]`, 'GET /api/ingredients 요청 수신');

        const ingredients = await IngredientRepository.findByUserId(userId);

        logger.info(`[User:${userId}]`, `식재료 ${ingredients.length}건 조회 완료`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '식재료 목록 조회 성공',
            data: ingredients // Array of ingredient objects
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `식재료 목록 조회 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '식재료 목록 조회 중 오류가 발생했습니다.'
        });
    }
};

// --- PUT /api/ingredients/:id (식재료 1건 수정) ---
/**
 * 특정 식재료 정보를 수정합니다. (소유권 확인 필수)
 */
const updateIngredient = async (req, res) => {
    try {
        const userId = req.user.id;
        const ingredientId = parseInt(req.params.id, 10);
        const updateData = req.body;
        
        logger.info(`[User:${userId}]`, `PUT /api/ingredients/${ingredientId} 요청 수신`);
        
        // 필수 입력값 검증
        validateIngredientInput(updateData);

        // Model에 수정 위임 (내부적으로 소유권 검사 포함)
        const updatedIngredient = await IngredientRepository.update(userId, ingredientId, updateData);

        if (!updatedIngredient) {
            logger.warn(`[User:${userId}]`, `PUT /api/ingredients/${ingredientId} - 식재료를 찾을 수 없음`);
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '수정하려는 식재료를 찾을 수 없습니다.'
            });
        }

        logger.info(`[User:${userId}]`, `식재료 수정 완료 (ingredient_id: ${ingredientId})`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '식재료가 수정되었습니다.',
            data: updatedIngredient 
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `식재료 수정 처리 중 오류: ${error.message}`);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '식재료 수정 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- DELETE /api/ingredients/:id (식재료 1건 삭제) ---
/**
 * 특정 식재료를 삭제합니다. (소유권 확인 필수)
 */
const deleteIngredient = async (req, res) => {
    try {
        const userId = req.user.id;
        const ingredientId = parseInt(req.params.id, 10);

        logger.info(`[User:${userId}]`, `DELETE /api/ingredients/${ingredientId} 요청 수신`);

        // Model에 삭제 위임 (내부적으로 소유권 검사 포함)
        const deleted = await IngredientRepository.delete(userId, ingredientId);

        if (!deleted) {
            logger.warn(`[User:${userId}]`, `DELETE /api/ingredients/${ingredientId} - 식재료를 찾을 수 없음`);
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '삭제하려는 식재료를 찾을 수 없습니다.'
            });
        }

        logger.info(`[User:${userId}]`, `식재료 삭제 완료 (ingredient_id: ${ingredientId})`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '식재료가 삭제되었습니다.'
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `식재료 삭제 처리 중 오류: ${error.message}`);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '식재료 삭제 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- POST /api/ingredients/consume (식재료 일괄 차감 - 요리 후) ---
/**
 * 요리에 사용된 식재료들을 보유 목록에서 차감합니다. (트랜잭션 사용)
 */
const consumeIngredients = async (req, res) => {
    try {
        const userId = req.user.id;
        const { ingredients } = req.body; // Array of { id, quantity_value, quantity_unit }

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
             return res.status(400).json({
                success: false,
                result_code: 400,
                message: "차감할 식재료 목록이 유효하지 않습니다."
            });
        }
        
        // Model에 차감 로직 위임 (트랜잭션 및 재고 검사 포함)
        await IngredientRepository.consumeBulk(userId, ingredients);

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '식재료가 성공적으로 차감되었습니다.'
        });

    } catch (error) {
        console.error('consumeIngredients 오류:', error);
        // Model에서 재고 부족(602) 또는 기타 오류 발생 시 처리
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '식재료 차감 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/ingredients/expiring (소비기한 임박 식재료 조회) ---
/**
 * 조회 시점으로부터 소비기한이 3일 이내인 식재료 목록을 조회합니다.
 */
const getExpiringIngredients = async (req, res) => {
    try {
        const userId = req.user.id;

        logger.info(`[User:${userId}]`, 'GET /api/ingredients/expiring 요청 수신');

        const expiringIngredients = await IngredientRepository.findExpiringIngredients(userId);

        logger.info(`[User:${userId}]`, `소비기한 임박 식재료 ${expiringIngredients.length}건 조회 완료`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '소비기한 임박 식재료 목록 조회 성공',
            data: expiringIngredients // Array of ingredient objects
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `소비기한 임박 식재료 조회 중 오류: ${error.message}`);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '소비기한 임박 식재료 조회 중 오류가 발생했습니다.'
        });
    }
};


module.exports = {
    createIngredient,
    createIngredientsBulk,
    getUserIngredients,
    updateIngredient,
    deleteIngredient,
    consumeIngredients,
    getExpiringIngredients,
};