// 파일 경로: src/controllers/masterData.controller.js

const { AllergyRepository } = require('../models/Allergy.model');
const { ToolRepository } = require('../models/Tool.model');


// --- GET /api/allergies (전체 알레르기 목록 조회) ---
/**
 * DB 또는 Model에 정의된 전체 알레르기 종류 목록을 반환합니다. (Public Access)
 */
const getAllAllergies = async (req, res) => {
    try {
        // Model에서 전체 허용 목록을 가져옵니다. (Array of Strings 반환 가정)
        const allergies = AllergyRepository.getAllowedAllergies();
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '전체 알레르기 목록 조회 성공',
            data: allergies // Array of Strings: ["난류", "우유", ...]
        });
    } catch (error) {
        console.error('getAllAllergies 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '알레르기 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/tools (전체 조리도구 목록 조회) ---
/**
 * DB 또는 Model에 정의된 전체 조리도구 종류 목록을 반환합니다. (Public Access)
 */
const getAllTools = async (req, res) => {
    try {
        // Model에서 전체 허용 목록을 가져옵니다. (Array of Strings 반환 가정)
        const tools = ToolRepository.getAllowedTools();
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '전체 조리도구 목록 조회 성공',
            data: tools // Array of Strings: ["냄비", "프라이팬", ...]
        });
    } catch (error) {
        console.error('getAllTools 오류:', error);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '조리도구 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
};


module.exports = {
    getAllAllergies,
    getAllTools
};