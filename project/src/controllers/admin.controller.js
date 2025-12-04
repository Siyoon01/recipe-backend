// 파일 경로: src/controllers/admin.controller.js

const { UserRepository } = require('../models/User.model');
const { RecipeRepository } = require('../models/Recipe.model');
const { IngredientRepository } = require('../models/Ingredient.model');
const { AllergyRepository } = require('../models/Allergy.model');
const { ToolRepository } = require('../models/Tool.model');
const { normalizeErrorCode } = require('../utils/errorHandler');


// --- 1. 사용자 관리 (User Management) ---

/**
 * GET /api/admin/users
 * 전체 사용자 목록을 조회합니다. (비밀번호 제외)
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await UserRepository.findAllUsers(); // 모든 사용자 조회
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: "전체 사용자 목록 조회 성공",
            data: users // Array of user objects (password excluded)
        });
    } catch (error) {
        console.error('getAllUsers 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '사용자 목록 조회 중 오류가 발생했습니다.'
        });
    }
};

/**
 * GET /api/admin/users/:id
 * 특정 사용자의 알레르기, 조리도구, 보유 식재료 정보를 상세 조회합니다.
 */
const getUserDetailsById = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        
        // 1. 해당 사용자가 존재하는지 확인
        const userExists = await UserRepository.findById(userId); 
        if (!userExists) {
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '해당 ID의 사용자를 찾을 수 없습니다.'
            });
        }

        // 2. 알레르기, 조리도구, 식재료 정보 조회
        const allergies = await AllergyRepository.findByUserId(userId);
        const tools = await ToolRepository.findByUserId(userId);
        const ingredients = await IngredientRepository.findByUserId(userId); // 전체 식재료 상세 조회

        res.status(200).json({
            success: true,
            result_code: 200,
            message: `사용자(ID: ${userId})의 상세 정보 조회 성공`,
            data: {
                userId: userId,
                // Model에서 받은 { id, name } 배열을 name만 있는 배열로 변환
                allergies: allergies.map(a => a.name), 
                tools: tools.map(t => t.name),
                ingredients: ingredients // Array of full ingredient objects
            }
        });
    } catch (error) {
        console.error('getUserDetailsById 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '사용자 상세 정보 조회 중 오류가 발생했습니다.'
        });
    }
};

/**
 * PUT /api/admin/users/:id
 * 특정 사용자 정보 (닉네임, 아이디, 이름, 성별, 생년월일)를 수정합니다.
 */
const updateUserById = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const updateData = req.body;
        
        // Model에 수정 로직 위임 (아이디 중복 검사, 형식 검사 포함)
        const updatedUser = await UserRepository.adminUpdate(userId, updateData);

        // 응답 형식에 user_id 필드 추가 (id와 같은 값)
        const responseData = {
            ...updatedUser,
            user_id: updatedUser.id
        };

        res.status(200).json({
            success: true,
            message: '사용자 정보가 성공적으로 수정되었습니다다.',
            result_code: 200,
            data: responseData
        });

    } catch (error) {
        console.error('updateUserById 오류:', error);
        // UserRepository에서 발생한 409, 404, 400 오류 등을 처리
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '사용자 정보 수정 중 오류가 발생했습니다.'
        });
    }
};

/**
 * DELETE /api/admin/users/:id
 * 특정 사용자를 강제 탈퇴 처리합니다. (관리자 본인 삭제 시도 방지 로직 포함)
 */
const deleteUserById = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        
        // 관리자가 자신을 삭제하는 시도 방지 (ID와 Role 확인)
        if (req.user.id === userId) {
             return res.status(400).json({
                success: false,
                result_code: 400,
                message: '관리자 계정은 이 API로 삭제할 수 없습니다.'
            });
        }
        
        const deleted = await UserRepository.deleteById(userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '삭제하려는 사용자를 찾을 수 없습니다.'
            });
        }

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '사용자가 강제 탈퇴 처리되었습니다.'
        });
    } catch (error) {
        console.error('deleteUserById 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '사용자 삭제 처리 중 오류가 발생했습니다.'
        });
    }
};


// --- 3. 통계 조회 (Statistics) ---

/**
 * GET /api/admin/stats/users
 * 사용자 통계 (성비, 연령대)를 조회합니다.
 */
const getUserStats = async (req, res) => {
    try {
        const stats = await UserRepository.getUserDemographics();
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '사용자 통계 조회에 성공했습니다.',
            data: stats
        });
    } catch (error) {
        console.error('getUserStats 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '사용자 통계 조회 중 오류가 발생했습니다.'
        });
    }
};

/**
 * GET /api/admin/stats/ingredients
 * 식재료 통계 (최다 등록)를 조회합니다.
 */
const getIngredientStats = async (req, res) => {
    try {
        // Model에서 식재료 이름별 COUNT 쿼리 실행
        const stats = await IngredientRepository.getTopRegisteredIngredients(10); // 상위 10개 조회 가정
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '최다 등록 식재료 통계 조회 성공',
            data: stats
        });
    } catch (error) {
        console.error('getIngredientStats 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '식재료 통계 조회 중 오류가 발생했습니다.'
        });
    }
};

/**
 * GET /api/admin/stats/recipes
 * 레시피 통계 (조회수/추천수 합산)를 조회합니다.
 */
const getRecipeStats = async (req, res) => {
    try {
        // Model에서 조회수와 추천 로그를 합산하여 통계 쿼리 실행
        const stats = await RecipeRepository.getRecipePerformanceStats(10); // 상위 10개 조회 가정
        
        res.status(200).json({
            success: true,
            message: '최다 조회 레시피 통계 조회 성공.',
            result_code: 200,
            data: stats
        });
    } catch (error) {
        console.error('getRecipeStats 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '레시피 통계 조회 중 오류가 발생했습니다.'
        });
    }
};


// --- 4. 레시피 관리 (Recipe Management) ---

/**
 * PUT /api/admin/recipes/:id
 * 레시피 전체 정보 (기본, 재료, 순서)를 수정합니다. (벌크 업데이트)
 */
const updateRecipeById = async (req, res) => {
    try {
        const recipeId = parseInt(req.params.id, 10);
        const fullRecipeData = req.body;
        
        // Model에 일괄 수정 로직 위임 (트랜잭션 포함)
        await RecipeRepository.updateFullRecipe(recipeId, fullRecipeData);

        res.status(200).json({
            success: true,
            result_code: 200,
            message: `레시피(ID: ${recipeId}) 정보가 성공적으로 수정되었습니다.`,
            // data는 RecipeRepository에서 반환된 수정된 기본 정보 객체라고 가정
            data: fullRecipeData // 임시로 요청 데이터를 그대로 반환
        });

    } catch (error) {
        console.error('updateRecipeById 오류:', error);
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '레시피 수정 처리 중 오류가 발생했습니다.'
        });
    }
};

/**
 * DELETE /api/admin/recipes/:id
 * 레시피를 삭제 처리합니다.
 */
const deleteRecipeById = async (req, res) => {
    try {
        const recipeId = parseInt(req.params.id, 10);
        
        const deleted = await RecipeRepository.deleteById(recipeId);

        if (!deleted) {
             return res.status(404).json({
                success: false,
                result_code: 404,
                message: '삭제하려는 레시피를 찾을 수 없습니다.'
            });
        }

        res.status(200).json({
            success: true,
            result_code: 200,
            message: `레시피(ID: ${recipeId})가 삭제되었습니다.`
        });
    } catch (error) {
        console.error('deleteRecipeById 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '레시피 삭제 처리 중 오류가 발생했습니다.'
        });
    }
};


module.exports = {
    getAllUsers, 
    getUserDetailsById,
    updateUserById, 
    deleteUserById, 
    updateRecipeById, 
    deleteRecipeById,
    getUserStats,
    getIngredientStats,
    getRecipeStats
};