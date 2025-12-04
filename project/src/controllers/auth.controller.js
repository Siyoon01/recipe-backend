// 파일 경로: src/controllers/auth.controller.js

const { UserRepository } = require('../models/User.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { normalizeErrorCode } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// 환경 변수에서 JWT 비밀 키 및 설정 가져오기
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';
const TOKEN_EXPIRY = '1d'; 
const RESET_TOKEN_EXPIRY = '10m'; // 비밀번호 재설정 임시 토큰 만료 시간 (10분)


// --- POST /api/auth/signup (회원가입) ---
/**
 * 신규 사용자 계정을 생성하고 DB에 저장합니다.
 */
const signupUser = async (req, res) => {
    const reqId = `Req:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        logger.info(`[${reqId}]`, 'POST /api/auth/signup 요청 수신');
        const { userId, userPW, fullName, nickname, gender, birthdate } = req.body;

        // 필수 필드 검증 (생략된 필드는 DB NN 제약 조건에 따라 추가 검증 필요)
        if (!userId || !userPW || !fullName || !nickname || !birthdate) {
            logger.warn(`[${reqId}]`, 'POST /api/auth/signup - 필수 입력 정보 누락');
            return res.status(400).json({
                success: false,
                result_code: 400,
                message: '필수 입력 정보가 누락되었습니다.'
            });
        }
        
        // 아이디 중복 검사
        if (await UserRepository.isUserIdDuplicate(userId)) {
            logger.warn(`[${reqId}]`, `POST /api/auth/signup - 아이디 중복 (userID: ${userId})`);
            return res.status(409).json({ success: false, result_code: 409, message: '이미 사용 중인 아이디입니다.' });
        }

        // 비밀번호 해시
        const hashedPassword = await bcrypt.hash(userPW, 10);
        
        // 사용자 데이터베이스 저장
        const newUser = await UserRepository.create({
            userId,
            userPW: hashedPassword,
            fullName,
            nickname,
            gender,
            birthdate,
        });

        logger.info(`[User:${newUser.id}]`, `회원가입 성공 (userID: ${userId})`);
        res.status(201).json({
            success: true,
            result_code: 201,
            message: '회원가입이 성공적으로 완료되었습니다.',
            data: newUser // User 객체 (비밀번호 제외)
        });

    } catch (error) {
        logger.error(`[${reqId}]`, `회원가입 처리 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '회원가입 처리 중 서버 오류가 발생했습니다.'
        });
    }
};

// --- POST /api/auth/login (로그인) ---
/**
 * 사용자 ID와 비밀번호를 검증하고, 성공 시 JWT를 발급합니다.
 */
const loginUser = async (req, res) => {
    const reqId = `Req:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        logger.info(`[${reqId}]`, 'POST /api/auth/login 요청 수신');
        const { userID, userPW } = req.body; // API 설계에 따라 userID로 받음

        if (!userID || !userPW) {
            logger.warn(`[${reqId}]`, 'POST /api/auth/login - 아이디 또는 비밀번호 누락');
            return res.status(400).json({ 
                success: false, 
                result_code: 400,
                message: '아이디와 비밀번호를 모두 입력해주세요.'
            });
        }

        // 1. 사용자 정보 및 해시된 비밀번호 조회 (비밀번호 해시값 포함)
        const user = await UserRepository.findByUserId(userID, true);
        if (!user) {
            logger.warn(`[${reqId}]`, `POST /api/auth/login - 사용자 없음 (userID: ${userID})`);
            return res.status(401).json({ 
                success: false, 
                result_code: 401,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 2. 비밀번호 일치 여부 확인 (bcrypt.compare 사용)
        const isMatch = await bcrypt.compare(userPW, user.password);
        if (!isMatch) {
            logger.warn(`[User:${user.id}]`, 'POST /api/auth/login - 비밀번호 불일치');
            return res.status(401).json({ 
                success: false, 
                result_code: 401,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 3. JWT 토큰 생성 (role 포함)
        const token = jwt.sign(
            { id: user.id, userId: user.userId, role: user.role },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        logger.info(`[User:${user.id}]`, `로그인 성공 (userID: ${user.userId})`);
        // 4. 다른 API와 일관된 응답 형식
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '로그인에 성공했습니다.',
            token: token,
            data: user.toJSON() // user 객체 (비밀번호 제외, userID 필드 포함)
        });

    } catch (error) {
        logger.error(`[${reqId}]`, `로그인 처리 중 오류: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            result_code: 500,
            message: '로그인 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/auth/profile (내 프로필 조회) ---
/**
 * 로그인된 사용자의 기본 정보를 조회합니다.
 */
const getUserProfile = async (req, res) => {
    try {
        const id = req.user.id; 
        const userProfile = await UserRepository.findById(id);

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '프로필 조회 성공',
            data: userProfile 
        });

    } catch (error) {
        console.error('getUserProfile 오류:', error);
        res.status(500).json({ success: false, result_code: 500, message: '프로필 조회 중 서버 오류가 발생했습니다.' });
    }
};

// --- PUT /api/auth/profile (내 프로필 수정) ---
/**
 * 로그인된 사용자의 기본 정보(닉네임, 이름, 생년월일 등)를 수정합니다. (비밀번호 확인 필수)
 */
const updateUserProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const { currentPassword, ...updateData } = req.body; 

        if (!currentPassword) {
            return res.status(400).json({ success: false, result_code: 400, message: '현재 비밀번호를 입력해주세요.' });
        }
        
        // 1. 현재 비밀번호 일치 여부 확인 (DB에서 해시된 비번 조회)
        const userWithHash = await UserRepository.findById(id, true);
        const isMatch = await bcrypt.compare(currentPassword, userWithHash.password);

        if (!isMatch) {
            return res.status(403).json({ success: false, result_code: 403, message: '현재 비밀번호가 일치하지 않습니다.' });
        }

        // 2. 중복 검사 및 업데이트
        const updatedUser = await UserRepository.update(id, updateData);

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '사용자 정보가 성공적으로 수정되었습니다.',
            data: updatedUser 
        });

    } catch (error) {
        console.error('updateUserProfile 오류:', error);
        // UserRepository에서 발생한 409(중복), 400(형식 오류) 등을 처리
        const errorCode = error.code ? normalizeErrorCode(error.code) : 500;
        res.status(errorCode).json({
            success: false,
            result_code: errorCode,
            message: error.message || '프로필 수정 중 오류가 발생했습니다.'
        });
    }
};

// --- DELETE /api/auth/profile (회원탈퇴) ---
/**
 * 로그인된 사용자 계정을 삭제합니다. (비밀번호 확인 필수)
 */
const deleteUserProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const { currentPassword } = req.body;

        // 1. 비밀번호 확인
        const userWithHash = await UserRepository.findById(id, true);
        const isMatch = await bcrypt.compare(currentPassword, userWithHash.password);

        if (!isMatch) {
            return res.status(403).json({ success: false, result_code: 403, message: '비밀번호가 일치하지 않습니다.' });
        }

        // 2. 계정 삭제 (DB의 CASCADE 설정으로 연관 데이터 자동 삭제)
        const deleted = await UserRepository.deleteById(id); 

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '회원탈퇴가 성공적으로 처리되었습니다.'
        });

    } catch (error) {
        console.error('deleteUserProfile 오류:', error);
        res.status(500).json({ success: false, result_code: 500, message: '회원 탈퇴 처리 중 오류가 발생했습니다.' });
    }
};


// --- POST /api/auth/find-id (아이디 찾기) ---
/**
 * 이름, 생년월일을 기준으로 사용자 아이디를 찾습니다.
 */
const findUserId = async (req, res) => {
    const reqId = `Req:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        logger.info(`[${reqId}]`, 'POST /api/user/find-id 요청 수신');
        const { fullName, birthdate } = req.body;

        if (!fullName || !birthdate) {
            logger.warn(`[${reqId}]`, 'POST /api/user/find-id - 이름 또는 생년월일 누락');
            return res.status(400).json({ success: false, result_code: 400, message: '이름과 생년월일을 모두 입력해주세요.' });
        }

        // Model에서 정보 일치 여부 확인 후 아이디 조회
        const user = await UserRepository.findIdByDetails({ fullName, birthdate });

        if (!user) {
            logger.warn(`[${reqId}]`, `POST /api/user/find-id - 일치하는 사용자 없음 (fullName: ${fullName})`);
            return res.status(404).json({ success: false, result_code: 404, message: '일치하는 사용자를 찾을 수 없습니다.' });
        }

        // 보안을 위해 아이디 일부만 마스킹 처리하여 반환
        // DB에서 조회한 결과는 userID 컬럼명으로 반환됨
        const userId = user.userID || user.userId;
        
        if (!userId) {
            logger.error(`[${reqId}]`, `POST /api/user/find-id - 사용자 정보에 userID가 없음`);
            return res.status(500).json({ success: false, result_code: 500, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
        }
        
        const maskedUserId = userId.length > 3 
            ? userId.substring(0, 3) + '***'
            : '***';
        
        logger.info(`[${reqId}]`, `아이디 찾기 성공 (fullName: ${fullName})`);
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '아이디 조회 성공',
            data: { userID: maskedUserId, userId: maskedUserId } // 호환성을 위해 둘 다 반환
        });

    } catch (error) {
        logger.error(`[${reqId}]`, `아이디 찾기 처리 중 오류: ${error.message}`);
        logger.error(`[${reqId}]`, `오류 스택: ${error.stack}`);
        logger.error(`[${reqId}]`, `요청 데이터: fullName=${req.body.fullName}, birthdate=${req.body.birthdate}`);
        res.status(500).json({ success: false, result_code: 500, message: '아이디 찾기 처리 중 서버 오류가 발생했습니다.' });
    }
};

// --- POST /api/user/verify-reset-identity (비밀번호 재설정 1단계: 본인 확인) ---
/**
 * 이름, 아이디, 생년월일(6자리)로 사용자 본인임을 확인하고 임시 재설정 토큰을 발급합니다.
 */
const verifyResetIdentity = async (req, res) => {
    try {
        const { userId, fullName, birthdate } = req.body;

        // 필수 필드 검증
        if (!userId || !fullName || !birthdate) {
            return res.status(400).json({ 
                success: false, 
                result_code: 400, 
                message: '이름, 아이디, 생년월일을 모두 입력해주세요.' 
            });
        }

        // 생년월일 6자리 검증
        if (typeof birthdate !== 'string' || birthdate.length !== 6 || !/^\d{6}$/.test(birthdate)) {
            return res.status(400).json({ 
                success: false, 
                result_code: 400, 
                message: '생년월일은 6자리 숫자로 입력해주세요. (예: 991225)' 
            });
        }

        // 1. 사용자 정보 일치 확인 (이름, 아이디, 생년월일 모두 확인)
        const user = await UserRepository.verifyUserByIdentity({ userId, fullName, birthdate });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                result_code: 404, 
                message: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' 
            });
        }

        // 2. 짧은 수명의 임시 재설정 토큰 생성
        const resetToken = jwt.sign(
            { id: user.id, purpose: 'password_reset' },
            JWT_SECRET,
            { expiresIn: RESET_TOKEN_EXPIRY }
        );
        
        res.status(200).json({
            success: true,
            result_code: 200,
            message: '사용자 정보가 확인되었습니다. 새로운 비밀번호를 설정해주세요.',
            data: { resetToken: resetToken }
        });

    } catch (error) {
        console.error('verifyResetIdentity 오류:', error);
        res.status(500).json({ 
            success: false, 
            result_code: 500, 
            message: '본인 확인 처리 중 서버 오류가 발생했습니다.' 
        });
    }
};


// --- POST /api/user/reset-password (비밀번호 재설정 2단계: 최종 처리) ---
/**
 * 임시 토큰, 새 비밀번호, 비밀번호 확인을 받아 비밀번호가 일치하는지 확인하고 재설정합니다.
 */
const resetUserPassword = async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        // 필수 필드 검증
        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                result_code: 400, 
                message: '재설정 토큰, 새 비밀번호, 비밀번호 확인을 모두 입력해주세요.' 
            });
        }

        // 비밀번호 일치 확인
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                result_code: 400, 
                message: '새 비밀번호와 비밀번호 확인이 일치하지 않습니다.' 
            });
        }
        
        // 1. 임시 토큰 검증 및 사용자 ID 획득
        let decoded;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
            if (decoded.purpose !== 'password_reset') {
                 throw new Error('Invalid token purpose');
            }
        } catch (err) {
            return res.status(403).json({ 
                success: false, 
                result_code: 403, 
                message: '토큰이 만료되었거나 유효하지 않습니다.' 
            });
        }

        // 2. 새 비밀번호 해싱
        const newHashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 3. 비밀번호 업데이트
        await UserRepository.updatePassword(decoded.id, newHashedPassword);

        res.status(200).json({
            success: true,
            result_code: 200,
            message: '비밀번호가 성공적으로 재설정되었습니다. 다시 로그인해주세요.'
        });

    } catch (error) {
        console.error('resetUserPassword 오류:', error);
        res.status(500).json({ 
            success: false, 
            result_code: 500, 
            message: '비밀번호 재설정 처리 중 서버 오류가 발생했습니다.' 
        });
    }
};


module.exports = {
    signupUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    deleteUserProfile,
    findUserId,
    resetUserPassword,
    verifyResetIdentity // <-- Step 1 API
};