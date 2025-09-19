// 식재료 관련 컨트롤러
const { IngredientRepository } = require('../models/Ingredient');

// 식재료 등록
const createIngredient = async (req, res) => {
  try {
    const { name, expiryDate, quantity } = req.body;
    const user_id = req.user.id; // JWT 토큰에서 사용자 ID (숫자) 가져오기

    // 입력값 검증
    if (!name || !expiryDate || !quantity) {
      return res.status(400).json({
        success: false,
        message: '식재료 이름, 소비기한, 수량을 모두 입력해주세요.'
      });
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiryDate)) {
      return res.status(400).json({
        success: false,
        message: '소비기한은 YYYY-MM-DD 형식으로 입력해주세요.'
      });
    }

    // 식재료 생성
    const newIngredient = await IngredientRepository.create(user_id, name, expiryDate, quantity);

    res.status(201).json({
      success: true,
      message: '식재료가 등록되었습니다.',
      ingredient: newIngredient.toJSON()
    });

  } catch (error) {
    console.error('식재료 등록 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 사용자별 식재료 조회
const getUserIngredients = async (req, res) => {
  try {
    const user_id = req.user.id; // JWT 토큰에서 사용자 ID (숫자) 가져오기

    const ingredients = await IngredientRepository.findByUserId(user_id);

    res.status(200).json({
      success: true,
      message: '식재료 목록 조회 성공',
      ingredients: ingredients.map(ingredient => ingredient.toJSON())
    });

  } catch (error) {
    console.error('식재료 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 식재료 수정
const updateIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, expiryDate, quantity } = req.body;
    const user_id = req.user.id;

    // 입력값 검증
    if (!name || !expiryDate || !quantity) {
      return res.status(400).json({
        success: false,
        message: '식재료 이름, 소비기한, 수량을 모두 입력해주세요.'
      });
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiryDate)) {
      return res.status(400).json({
        success: false,
        message: '소비기한은 YYYY-MM-DD 형식으로 입력해주세요.'
      });
    }

    // 식재료 수정
    const updatedIngredient = await IngredientRepository.update(id, name, expiryDate, quantity);

    if (!updatedIngredient) {
      return res.status(404).json({
        success: false,
        message: '식재료를 찾을 수 없습니다.'
      });
    }

    res.status(200).json({
      success: true,
      message: '식재료가 수정되었습니다.',
      ingredient: updatedIngredient.toJSON()
    });

  } catch (error) {
    console.error('식재료 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 식재료 삭제
const deleteIngredient = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await IngredientRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '식재료를 찾을 수 없습니다.'
      });
    }

    res.status(200).json({
      success: true,
      message: '식재료가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('식재료 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  createIngredient,
  getUserIngredients,
  updateIngredient,
  deleteIngredient
};
