// 인증 관련 컨트롤러
const { UserRepository } = require('../models/User');

// 회원가입 처리
const signup = async (req, res) => {
  try {
    const { nickname, userID, userPW } = req.body;

    // 입력값 검증
    if (!nickname || !userID || !userPW) {
      return res.status(400).json({
        success: false,
        message: '닉네임, 아이디, 비밀번호를 모두 입력해주세요.'
      });
    }

    // 아이디 길이 검증 (예: 3자 이상)
    if (userID.length < 3) {
      return res.status(400).json({
        success: false,
        message: '아이디는 3자 이상이어야 합니다.'
      });
    }

    // 비밀번호 길이 검증 (예: 4자 이상)
    if (userPW.length < 4) {
      return res.status(400).json({
        success: false,
        message: '비밀번호는 4자 이상이어야 합니다.'
      });
    }

    // 사용자 생성
    const newUser = await UserRepository.create(nickname, userID, userPW);

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: newUser.toJSON()
    });

  } catch (error) {
    if (error.message === '이미 존재하는 아이디입니다.') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 로그인 처리
const login = async (req, res) => {
  try {
    const { userID, userPW } = req.body;

    // 입력값 검증
    if (!userID || !userPW) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요.'
      });
    }

    // 사용자 인증
    const user = await UserRepository.authenticate(userID, userPW);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 로그인 성공
    res.status(200).json({
      success: true,
      message: '로그인에 성공했습니다.',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  signup,
  login
};
