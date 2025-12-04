// 파일 경로: src/models/Allergy.model.js

const { pool } = require('../../server');

// --- 0. 마스터 데이터 (하드코딩된 허용 목록) ---
const ALLOWED_ALLERGIES = [
  '난류(가금류)', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', 
  '돼지고기', '복숭아', '토마토', '아황산염', '호두', '닭고기', '소고기', '오징어', 
  '조개류(굴, 전복, 홍합 포함)'
];


// --- 1. 알레르기 데이터 클래스 ---
class Allergy {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

// --- 2. 알레르기 저장소 (Repository) ---
class AllergyRepository {

  /**
   * 전체 허용 목록을 반환합니다. (Controller에서 사용)
   */
  static getAllowedAllergies() {
    return ALLOWED_ALLERGIES;
  }

  /**
   * 알레르기 이름 배열을 허용 목록과 비교하여 유효성을 검사합니다.
   * @throws {Error} 400 Bad Request
   */
  static validateAllergyNames(allergyNames) {
    const invalidAllergies = allergyNames.filter(name => !ALLOWED_ALLERGIES.includes(name));
    
    if (invalidAllergies.length > 0) {
      const error = new Error(`허용되지 않은 알레르기입니다: ${invalidAllergies.join(', ')}`);
      error.code = 601; // 601: 허용되지 않은 값 입력
      throw error;
    }
  }

  /**
   * 유효성이 검증된 알레르기 이름 배열을 받아 해당 ID 배열을 DB에서 조회합니다.
   */
  static async findIdsByNames(names, connection = pool) {
    if (names.length === 0) return [];
    
    const placeholders = names.map(() => '?').join(','); 
    
    // DB에서 이름으로 ID를 조회
    const [rows] = await connection.query(`SELECT id FROM allergies WHERE name IN (${placeholders})`, names);
    
    // DB에 데이터가 누락된 경우 (마스터 테이블에 등록되지 않은 경우) 오류 처리
    if (rows.length !== names.length) {
       const error = new Error("DB 마스터 테이블에 등록되지 않은 알레르기 정보가 포함되어 있습니다.");
       error.code = 500; // 500 Internal Server Error
       throw error;
    }

    return rows.map(row => row.id);
  }

  /**
   * PUT /api/profile/allergies
   * 사용자의 알레르기 정보를 업데이트합니다. (기존 정보 삭제 후 새 정보 삽입 - 트랜잭션)
   */
  static async updateUserAllergies(userId, allergyNames) {
    // 1. 입력값 유효성 검증
    this.validateAllergyNames(allergyNames);
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction(); // 트랜잭션 시작

      // 2. 기존 알레르기 정보 모두 삭제 (Full Replacement)
      await connection.execute('DELETE FROM user_allergies WHERE user_id = ?', [userId]);

      // 3. 새로운 알레르기 정보가 있다면, 처리
      if (allergyNames.length > 0) {
        // 3-1. 알레르기 이름으로 ID 배열 조회
        const allergyIds = await this.findIdsByNames(allergyNames, connection);
        
        // 3-2. user_allergies 테이블에 새로운 정보 삽입 (bulk insert)
        const values = allergyIds.map(allergyId => [userId, allergyId]);
        await connection.query('INSERT INTO user_allergies (user_id, allergy_id) VALUES ?', [values]);
      }

      await connection.commit(); // 모든 작업이 성공했으면 커밋
      
    } catch (error) {
      await connection.rollback(); // 실패 시 롤백
      console.error('updateUserAllergies 트랜잭션 오류:', error);
      // Repository에서 throw된 오류를 포함하여 재throw
      throw error; 
    } finally {
      connection.release(); // 커넥션 반환
    }
  }

  /**
   * GET /api/profile/allergies
   * 사용자 ID에 해당하는 알레르기 목록을 조회합니다.
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT a.id, a.name 
        FROM allergies a
        INNER JOIN user_allergies ua ON a.id = ua.allergy_id
        WHERE ua.user_id = ?
        ORDER BY a.name ASC
      `;
      const [rows] = await pool.execute(query, [userId]);
      
      // { id, name } 객체의 배열 반환 (Controller에서 List of Strings로 변환 가능)
      return rows; 
    } catch (error) {
      console.error('findByUserId 오류:', error);
      throw error;
    }
  }
}

module.exports = {
  AllergyRepository,
  Allergy 
};