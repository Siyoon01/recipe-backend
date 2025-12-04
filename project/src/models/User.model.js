// 파일 경로: src/models/User.model.js

const { pool } = require('../../server');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const saltRounds = 10; // 비밀번호 해싱 복잡도

// --- 1. 사용자 데이터 클래스 (반환 객체 구조) ---
class User {
  constructor(data) {
    this.id = data.id;
    this.nickname = data.nickname;
    this.userId = data.userID; // DB: userID -> JS: userId
    this.password = data.userPW; // DB: userPW (해시값)
    this.fullName = data.fullName; // DB: fullName -> JS: fullName
    this.birthdate = data.birthdate;
    this.gender = data.gender;
    this.role = data.role;
    this.createdAt = data.createAt; // DB: createAt -> JS: createdAt
  }

  // API 응답 시 사용 (비밀번호 제외)
  toJSON() {
    return {
      id: this.id,
      nickname: this.nickname,
      userID: this.userId, // API 설계에 따라 userID로 반환
      fullName: this.fullName,
      birthdate: this.birthdate,
      gender: this.gender,
      role: this.role,
      createdAt: this.createdAt
    };
  }
}

// --- 2. 사용자 저장소 (Repository) ---
class UserRepository {
  
  /**
   * 아이디 중복을 검사합니다.
   */
  static async isUserIdDuplicate(userId) {
    const [rows] = await pool.execute('SELECT 1 FROM users WHERE userID = ?', [userId]);
    return rows.length > 0;
  }

  /**
   * 새 사용자 계정을 생성합니다.
   */
  static async create(data) {
    try {
        const { userId, userPW, fullName, nickname, gender, birthdate } = data;
        
        const insertQuery = `
            INSERT INTO users (userID, userPW, fullName, nickname, gender, birthdate) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        // userPW는 이미 Controller에서 해시되어 넘어왔다고 가정
        const [result] = await pool.execute(insertQuery, [
            userId, userPW, fullName, nickname, gender, birthdate
        ]);
        
        return this.findById(result.insertId);

    } catch (error) {
        console.error('UserRepository.create 오류:', error);
        // DB 제약조건 오류(예: UNIQUE 위반)를 500으로 처리
        const err = new Error('데이터베이스에 데이터를 저장하는 중 오류가 발생했습니다.');
        err.code = 500;
        throw err;
    }
  }

  /**
   * ID로 사용자 정보를 조회합니다.
   * @param {number} id - 사용자 ID
   * @param {boolean} includePassword - 비밀번호 해시 포함 여부 (기본값: false)
   */
  static async findById(id, includePassword = false) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    
    const user = new User(rows[0]);
    if (includePassword) {
      return user; // User 클래스 인스턴스 (password hash 포함) 반환
    }
    return user.toJSON();
  }

  /**
   * 사용자 ID로 정보를 조회합니다. (로그인 검증을 위해 비밀번호 해시 포함)
   */
  static async findByUserId(userId, includePassword = false) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE userID = ?', [userId]);
    if (rows.length === 0) return null;
    
    const user = new User(rows[0]);
    if (includePassword) {
        return user; // User 클래스 인스턴스 (password hash 포함) 반환
    }
    return user.toJSON();
  }

  /**
   * PUT /api/auth/profile: 사용자 본인 프로필을 수정합니다.
   */
  static async update(id, updateData) {
    // Controller에서 currentPassword 검증 후 호출되며, password 필드는 넘어오지 않음
    const fields = [];
    const values = [];

    if (updateData.nickname) { fields.push('nickname = ?'); values.push(updateData.nickname); }
    if (updateData.fullName) { fields.push('fullName = ?'); values.push(updateData.fullName); }
    if (updateData.birthdate) { fields.push('birthdate = ?'); values.push(updateData.birthdate); }
    if (updateData.gender) { fields.push('gender = ?'); values.push(updateData.gender); }
    
    if (fields.length === 0) return this.findById(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await pool.execute(query, [...values, id]);
    
    return this.findById(id); // 업데이트된 정보 반환
  }
  
  /**
   * PUT /api/admin/users/:id: 관리자가 사용자 정보를 수정합니다.
   * nickname, userID, fullName, birthdate, gender 수정 가능
   */
  static async adminUpdate(id, updateData) {
    try {
      // 1. userID 수정 시 중복 검사
      if (updateData.userID) {
        // 현재 사용자를 제외한 다른 사용자가 같은 userID를 사용하는지 확인
        const [existingRows] = await pool.execute(
          'SELECT id FROM users WHERE userID = ? AND id != ?',
          [updateData.userID, id]
        );
        
        if (existingRows.length > 0) {
          const err = new Error('이미 사용 중인 아이디입니다.');
          err.code = 409; // 409 Conflict
          throw err;
        }
      }
      
      // 2. 수정할 필드 구성
      const fields = [];
      const values = [];
      
      if (updateData.nickname !== undefined) {
        fields.push('nickname = ?');
        values.push(updateData.nickname);
      }
      if (updateData.userID !== undefined) {
        fields.push('userID = ?');
        values.push(updateData.userID);
      }
      if (updateData.fullName !== undefined) {
        fields.push('fullName = ?');
        values.push(updateData.fullName);
      }
      if (updateData.birthdate !== undefined) {
        fields.push('birthdate = ?');
        values.push(updateData.birthdate);
      }
      if (updateData.gender !== undefined) {
        fields.push('gender = ?');
        values.push(updateData.gender);
      }
      
      // 3. 수정할 필드가 없으면 현재 정보 반환
      if (fields.length === 0) {
        return this.findById(id);
      }
      
      // 4. 사용자 존재 여부 확인
      const existingUser = await this.findById(id);
      if (!existingUser) {
        const err = new Error('수정하려는 사용자를 찾을 수 없습니다.');
        err.code = 404;
        throw err;
      }

      // 5. DB 업데이트
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await pool.execute(query, [...values, id]);
      
      // 6. 업데이트된 사용자 정보 반환
      return this.findById(id);
      
    } catch (error) {
      console.error('UserRepository.adminUpdate 오류:', error);
      // 이미 에러 코드가 있으면 그대로 throw, 없으면 500
      if (error.code) {
        throw error;
      }
      const err = new Error('사용자 정보 수정 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }

  /**
   * DELETE /api/auth/profile 및 /api/admin/users/:id: 계정 삭제
   */
  static async deleteById(id) {
    // DB의 ON DELETE CASCADE 설정으로 연관된 모든 데이터가 함께 삭제됨
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * POST /api/auth/find-id: 계정 복구용 정보 조회 (이름, 생년월일만)
   */
  static async findIdByDetails({ fullName, birthdate }) {
    try {
      // FullName, Birthdate를 기준으로 조회
      const query = `
        SELECT id, userID FROM users 
        WHERE fullName = ? AND birthdate = ?
      `;
      logger.info('UserRepository.findIdByDetails', `쿼리 실행: fullName=${fullName}, birthdate=${birthdate}`);
      const [rows] = await pool.execute(query, [fullName, birthdate]);
      logger.info('UserRepository.findIdByDetails', `조회 결과: ${rows.length}개 행`);
      return rows.length === 0 ? null : rows[0];
    } catch (error) {
      logger.error('UserRepository.findIdByDetails', `오류 발생: ${error.message}, 스택: ${error.stack}`);
      throw error;
    }
  }

  /**
   * POST /api/user/verify-reset-identity: 이름, 아이디, 생년월일로 사용자 검증
   */
  static async verifyUserByIdentity({ userId, fullName, birthdate }) {
    // userId, fullName, birthdate를 모두 사용하여 조회
    const query = `
      SELECT id, userID FROM users 
      WHERE userID = ? AND fullName = ? AND birthdate = ?
    `;
    const [rows] = await pool.execute(query, [userId, fullName, birthdate]);
    return rows.length === 0 ? null : rows[0];
  }
  
  /**
   * POST /api/auth/reset-password: 비밀번호 재설정 처리
   */
  static async updatePassword(id, newHashedPassword) {
    const query = 'UPDATE users SET userPW = ? WHERE id = ?';
    await pool.execute(query, [newHashedPassword, id]);
  }

  /**
   * GET /api/admin/users: 관리자용 전체 사용자 목록 조회
   */
  static async findAllUsers() {
      const [rows] = await pool.execute('SELECT id, userID, nickname, fullName, birthdate, gender, role, createAt FROM users');
      return rows.map(row => new User(row).toJSON());
  }

  /**
   * GET /api/admin/stats/users: 관리자 통계용 인구 통계 데이터 조회
   * genderRatio: { male: count, female: count }
   * ageGroups: { "10s": count, "20s": count, "30s": count, "40_plus": count }
   */
  static async getUserDemographics() {
    try {
      // 1. 성별 통계 조회
      const [genderRows] = await pool.execute(
        "SELECT gender, COUNT(id) AS count FROM users GROUP BY gender"
      );
      
      // 2. 연령대 통계 조회 (생년월일이 varchar 형식의 6자리 YYMMDD)
      // YY를 추출하여 현재 연도와 비교하여 나이 계산
      const [ageRows] = await pool.execute(`
        SELECT 
          CASE 
            WHEN CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED) >= 0 
                 AND CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED) <= 50 THEN
              CASE 
                WHEN (YEAR(CURDATE()) - (2000 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 20 THEN '10s'
                WHEN (YEAR(CURDATE()) - (2000 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 30 THEN '20s'
                WHEN (YEAR(CURDATE()) - (2000 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 40 THEN '30s'
                ELSE '40_plus'
              END
            ELSE
              CASE 
                WHEN (YEAR(CURDATE()) - (1900 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 20 THEN '10s'
                WHEN (YEAR(CURDATE()) - (1900 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 30 THEN '20s'
                WHEN (YEAR(CURDATE()) - (1900 + CAST(SUBSTRING(birthdate, 1, 2) AS UNSIGNED))) < 40 THEN '30s'
                ELSE '40_plus'
              END
          END AS ageGroup,
          COUNT(id) AS count
        FROM users
        WHERE birthdate IS NOT NULL 
          AND LENGTH(CAST(birthdate AS CHAR)) = 6 
          AND CAST(birthdate AS CHAR) REGEXP '^[0-9]{6}$'
        GROUP BY ageGroup
      `);
      
      // 3. genderRatio 구성 (male, female로 정확히 매핑)
      const genderRatio = {
        male: 0,
        female: 0
      };
      genderRows.forEach(row => {
        const gender = row.gender?.toLowerCase();
        if (gender === 'male' || gender === 'm') {
          genderRatio.male = row.count;
        } else if (gender === 'female' || gender === 'f') {
          genderRatio.female = row.count;
        }
      });
      
      // 4. ageGroups 구성
      const ageGroups = {
        "10s": 0,
        "20s": 0,
        "30s": 0,
        "40_plus": 0
      };
      ageRows.forEach(row => {
        if (ageGroups.hasOwnProperty(row.ageGroup)) {
          ageGroups[row.ageGroup] = row.count;
        }
      });
      
      return {
        genderRatio,
        ageGroups
      };
    } catch (error) {
      console.error('UserRepository.getUserDemographics 오류:', error);
      throw error;
    }
  }
}

module.exports = {
  UserRepository,
  User 
};