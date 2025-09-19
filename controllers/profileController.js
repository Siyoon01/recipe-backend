const { AllergyRepository } = require('../models/Allergy');
const { ToolRepository } = require('../models/Tool');

// 사용자 알레르기 정보 업데이트
const updateUserAllergies = async (req, res) => {
  try {
    const userId = req.user.id; // authenticateToken 미들웨어에서 넣어준 사용자 id
    const { allergies: allergyNames } = req.body; // ["우유", "갑각류"] 같은 배열

    if (!Array.isArray(allergyNames)) {
      return res.status(400).json({
        success: false,
        message: '알레르기 정보는 배열 형태로 보내야 합니다.'
      });
    }

    // 데이터베이스 로직은 모델에 위임
    await AllergyRepository.updateUserAllergies(userId, allergyNames);

    res.status(200).json({
      success: true,
      message: '알레르기 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('알레르기 정보 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 사용자 조리도구 정보 업데이트
const updateUserTools = async (req, res) => {
    try {
      const userId = req.user.id;
      const { tools: toolsObject } = req.body; // { "wok": true, "oven": false } 형태의 객체
  
      // 1. 객체를 배열로 변환: 값이 true인 key만 추출
      const toolNames = Object.keys(toolsObject).filter(key => toolsObject[key] === true);
  
      // 2. 데이터베이스 로직은 모델에 위임
      await ToolRepository.updateUserTools(userId, toolNames);
  
      res.status(200).json({
        success: true,
        message: '조리도구 정보가 성공적으로 업데이트되었습니다.'
      });
  
    } catch (error) {
        console.error('조리도구 정보 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
};

// 사용자 알레르기 정보 조회
const getUserAllergies = async (req, res) => {
  try {
    const userId = req.user.id;
    const allergies = await AllergyRepository.findByUserId(userId);
    
    res.status(200).json({
      success: true,
      message: '알레르기 정보 조회 성공',
      allergies: allergies
    });
  } catch (error) {
    console.error('알레르기 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 사용자 조리도구 정보 조회
const getUserTools = async (req, res) => {
  try {
    const userId = req.user.id;
    const tools = await ToolRepository.findByUserId(userId);
    
    res.status(200).json({
      success: true,
      message: '조리도구 정보 조회 성공',
      tools: tools
    });
  } catch (error) {
    console.error('조리도구 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  updateUserAllergies,
  updateUserTools,
  getUserAllergies,
  getUserTools
};