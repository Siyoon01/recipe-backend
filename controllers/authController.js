// 인증 관련 컨트롤러
const { UserRepository } = require('../models/User');
const { generateToken } = require('../middleware/auth');

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

    // JWT 토큰 생성
    const token = generateToken(user);

    // 로그인 성공
    res.status(200).json({
      success: true,
      message: '로그인에 성공했습니다.',
      user: user.toJSON(),
      token: token
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 사용자 프로필 조회 (보호된 라우트)
const getProfile = async (req, res) => {
  try {
    // req.user는 authenticateToken 미들웨어에서 설정됨
    const user = await UserRepository.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // Mypage에서 필요한 정보를 모두 포함하여 반환
    res.status(200).json({
      success: true,
      message: '프로필 조회 성공',
      user: {
        id: user.id,
        nickname: user.nickname,
        username: user.userID, // userID를 username으로 매핑
        password: '', // 보안상 비밀번호는 반환하지 않음
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 사용자 정보 수정 (보호된 라우트)
const updateProfile = async (req, res) => {
  try {
    const { nickname, username, password } = req.body;
    const userId = req.user.id;

    // 입력값 검증
    if (!nickname || !username) {
      return res.status(400).json({
        success: false,
        message: '닉네임과 아이디는 필수입니다.'
      });
    }

    // 현재 사용자 정보 조회
    const currentUser = await UserRepository.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 아이디 중복 확인 (다른 사용자가 사용 중인지)
    if (username !== currentUser.userID) {
      const existingUser = await UserRepository.findByUserID(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 아이디입니다.'
        });
      }
    }

    // 사용자 정보 업데이트
    const updateData = {
      nickname: nickname,
      userID: username
    };

    // 비밀번호가 제공된 경우에만 업데이트
    if (password && password.trim() !== '') {
      updateData.userPW = password;
    }

    // UserRepository에 업데이트 메서드가 필요하므로 임시로 직접 쿼리 실행
    const { pool } = require('../config/database');
    
    if (password && password.trim() !== '') {
      // 비밀번호 포함 업데이트
      await pool.execute(
        'UPDATE users SET nickname = ?, userID = ?, userPW = ? WHERE id = ?',
        [nickname, username, password, userId]
      );
    } else {
      // 비밀번호 제외 업데이트
      await pool.execute(
        'UPDATE users SET nickname = ?, userID = ? WHERE id = ?',
        [nickname, username, userId]
      );
    }

    // 업데이트된 사용자 정보 조회
    const updatedUser = await UserRepository.findById(userId);

    res.status(200).json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        username: updatedUser.userID,
        createdAt: updatedUser.createdAt
      }
    });

  } catch (error) {
    console.error('사용자 정보 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile
};
