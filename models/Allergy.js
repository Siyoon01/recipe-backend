const { pool } = require('../config/database');

class Allergy {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

class AllergyRepository {
  // 사용자의 알레르기 정보를 업데이트 (트랜잭션 사용)
  static async updateUserAllergies(userId, allergyNames) {
    const connection = await pool.getConnection(); // 트랜잭션을 위해 직접 커넥션 가져오기
    try {
      await connection.beginTransaction(); // 트랜잭션 시작

      // 1. 해당 유저의 기존 알레르기 정보를 모두 삭제
      await connection.execute('DELETE FROM user_allergies WHERE user_id = ?', [userId]);

      // 2. 새로운 알레르기 정보가 있다면, 처리
      if (allergyNames && allergyNames.length > 0) {
        // 2-1. 알레르기 이름 배열로 알레르기 ID 배열 찾기 (없으면 새로 생성)
        const allergyIds = await this.findOrCreateByName(allergyNames, connection);
        
        // 2-2. user_allergies 테이블에 새로운 정보 삽입
        const values = allergyIds.map(allergyId => [userId, allergyId]);
        await connection.query('INSERT INTO user_allergies (user_id, allergy_id) VALUES ?', [values]);
      }

      await connection.commit(); // 모든 작업이 성공했으면 커밋
      
    } catch (error) {
      await connection.rollback(); // 하나라도 실패하면 롤백
      console.error('updateUserAllergies 트랜잭션 오류:', error);
      throw error; // 에러를 컨트롤러로 전파
    } finally {
      connection.release(); // 커넥션 반환
    }
  }

  // 알레르기 이름 배열을 받아 ID 배열을 반환하는 헬퍼 메서드
  // (트랜잭션 내에서 동일한 커넥션을 사용해야 함)
  static async findOrCreateByName(names, connection) {
    const allergyIds = [];
    for (const name of names) {
      // 이미 존재하는지 확인
      let [rows] = await connection.execute('SELECT id FROM allergies WHERE name = ?', [name]);
      
      let allergyId;
      if (rows.length > 0) {
        // 존재하면 해당 ID 사용
        allergyId = rows[0].id;
      } else {
        // 존재하지 않으면 allergies 마스터 테이블에 새로 추가
        const [result] = await connection.execute('INSERT INTO allergies (name) VALUES (?)', [name]);
        allergyId = result.insertId;
      }
      allergyIds.push(allergyId);
    }
    return allergyIds;
  }

  // 사용자별 알레르기 조회
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT a.name 
        FROM allergies a
        INNER JOIN user_allergies ua ON a.id = ua.allergy_id
        WHERE ua.user_id = ?
      `;
      const [rows] = await pool.execute(query, [userId]);
      return rows.map(row => row.name);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  Allergy,
  AllergyRepository
};