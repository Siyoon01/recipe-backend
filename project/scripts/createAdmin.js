// 파일 경로: scripts/createAdmin.js
// admin 계정을 생성하는 스크립트

require('dotenv').config();
const { pool } = require('../src/config/database');
const bcrypt = require('bcrypt');

async function createAdminAccount() {
  try {
    // admin 계정 정보 (필요에 따라 수정 가능)
    const adminData = {
      userId: 'admin',
      userPW: 'admin123', // 기본 비밀번호 (프로덕션에서는 반드시 변경하세요!)
      fullName: '관리자',
      nickname: '관리자',
      gender: 'male',
      birthdate: '19900101',
      role: 'admin'
    };

    console.log('🔐 Admin 계정 생성 시작...');
    console.log(`📝 아이디: ${adminData.userId}`);
    console.log(`📝 비밀번호: ${adminData.userPW} (프로덕션에서는 반드시 변경하세요!)`);

    // 1. 아이디 중복 확인
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE userID = ?',
      [adminData.userId]
    );

    if (existingUsers.length > 0) {
      console.log('⚠️  이미 존재하는 아이디입니다.');
      console.log('💡 기존 계정의 role을 admin으로 변경하시겠습니까?');
      console.log('   또는 다른 아이디를 사용하세요.');
      process.exit(1);
    }

    // 2. 비밀번호 해시
    const hashedPassword = await bcrypt.hash(adminData.userPW, 10);
    console.log('✅ 비밀번호 해시 완료');

    // 3. admin 계정 생성
    const insertQuery = `
      INSERT INTO users (userID, userPW, fullName, nickname, gender, birthdate, role) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertQuery, [
      adminData.userId,
      hashedPassword,
      adminData.fullName,
      adminData.nickname,
      adminData.gender,
      adminData.birthdate,
      adminData.role
    ]);

    console.log('✅ Admin 계정 생성 완료!');
    console.log(`📊 생성된 사용자 ID: ${result.insertId}`);
    console.log('\n📋 계정 정보:');
    console.log(`   - 아이디: ${adminData.userId}`);
    console.log(`   - 비밀번호: ${adminData.userPW}`);
    console.log(`   - 이름: ${adminData.fullName}`);
    console.log(`   - 닉네임: ${adminData.nickname}`);
    console.log(`   - 역할: ${adminData.role}`);
    console.log('\n⚠️  프로덕션 환경에서는 반드시 비밀번호를 변경하세요!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Admin 계정 생성 실패:', error.message);
    console.error('💡 다음 사항을 확인해주세요:');
    console.error('   1. 데이터베이스 연결 상태');
    console.error('   2. users 테이블의 role 컬럼 존재 여부');
    console.error('   3. 필수 필드 제약 조건');
    process.exit(1);
  }
}

// 스크립트 실행
createAdminAccount();

