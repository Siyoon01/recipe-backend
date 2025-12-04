// 파일 경로: src/controllers/user.controller.js

const { AllergyRepository } = require('../models/Allergy.model');
const { ToolRepository } = require('../models/Tool.model');
const { normalizeErrorCode } = require('../utils/errorHandler');

// --- PUT /api/profile/allergies ---
/**
 * 사용자의 알레르기 목록을 전체 수정합니다. (DELETE 후 INSERT)
 */
const updateUserAllergies = async (req, res) => {
  try {
    const userId = req.user.id; // 토큰에서 추출
    const { allergies: allergyNames } = req.body; 

    // 입력값 검증 (배열 형식 확인)
    if (!Array.isArray(allergyNames)) {
      return res.status(400).json({
        success: false,
        result_code: 400,
        message: '알레르기 정보는 배열 형태로 보내야 합니다.'
      });
    }

    // Model에 업데이트 위임 (내부적으로 마스터 검증 및 트랜잭션 처리)
    await AllergyRepository.updateUserAllergies(userId, allergyNames);

    res.status(200).json({
      success: true,
      result_code: 200,
      message: '알레르기 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('updateUserAllergies 오류:', error);
    // Repository에서 throw된 601(허용되지 않은 값 입력) 또는 500 오류 처리
    const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
    res.status(errorCode).json({ 
      success: false,
      result_code: errorCode,
      message: error.message || '알레르기 정보 수정 중 서버 오류가 발생했습니다.'
    });
  }
};

// --- PUT /api/profile/tools ---
/**
 * 사용자의 조리도구 목록을 전체 수정합니다. (DELETE 후 INSERT)
 */
const updateUserTools = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tools: toolsObject } = req.body; // { "냄비": true, "오븐": false } 형태

    if (!toolsObject || typeof toolsObject !== 'object') {
        return res.status(400).json({
            success: false,
            result_code: 400,
            message: '조리도구 정보는 JSON 객체 형태로 보내야 합니다.'
        });
    }
    
    // 1. 객체를 배열로 변환: 값이 true인 key만 추출 (["냄비", "프라이팬"])
    const toolNames = Object.keys(toolsObject).filter(key => toolsObject[key] === true);

    // Model에 업데이트 위임
    await ToolRepository.updateUserTools(userId, toolNames);

    res.status(200).json({
      success: true,
      result_code: 200,
      message: '조리도구 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('updateUserTools 오류:', error);
    const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
    res.status(errorCode).json({
      success: false,
      result_code: errorCode,
      message: error.message || '조리도구 정보 수정 중 서버 오류가 발생했습니다.'
    });
  }
};

// --- GET /api/profile/allergies ---
/**
 * 사용자의 알레르기 목록을 조회합니다. (ID와 Name을 포함한 배열)
 */
const getUserAllergies = async (req, res) => {
  try {
    const userId = req.user.id;
    // Model에서 { id, name } 객체 배열을 조회
    const allergies = await AllergyRepository.findByUserId(userId); 
    
    res.status(200).json({
      success: true,
      result_code: 200,
      message: '알레르기 정보 조회 성공',
      data: allergies // Array of { id, name }
    });
  } catch (error) {
    console.error('getUserAllergies 오류:', error);
    res.status(500).json({
      success: false,
      result_code: 500,
      message: '알레르기 정보를 불러오는 중 오류가 발생했습니다.'
    });
  }
};

// --- GET /api/profile/tools ---
/**
 * 사용자의 조리도구 목록을 조회합니다. (ID와 Name을 포함한 배열)
 */
const getUserTools = async (req, res) => {
  try {
    const userId = req.user.id;
    // Model에서 { id, name } 객체 배열을 조회
    const tools = await ToolRepository.findByUserId(userId);
    
    res.status(200).json({
      success: true,
      result_code: 200,
      message: '조리도구 정보 조회 성공',
      data: tools // Array of { id, name }
    });
  } catch (error) {
    console.error('getUserTools 오류:', error);
    res.status(500).json({
      success: false,
      result_code: 500,
      message: '조리도구 정보를 불러오는 중 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  updateUserAllergies,
  updateUserTools,
  getUserAllergies,
  getUserTools
};
