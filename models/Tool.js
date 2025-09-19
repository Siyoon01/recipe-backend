const { pool } = require('../config/database');

class Tool {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

class ToolRepository {
  // 사용자의 조리도구 정보를 업데이트 (트랜잭션 사용)
  static async updateUserTools(userId, toolNames) {
    const connection = await pool.getConnection(); // 트랜잭션을 위해 직접 커넥션 가져오기
    try {
      await connection.beginTransaction(); // 트랜잭션 시작

      // 1. 해당 유저의 기존 조리도구 정보를 모두 삭제
      await connection.execute('DELETE FROM user_tools WHERE user_id = ?', [userId]);

      // 2. 새로운 조리도구 정보가 있다면, 처리
      if (toolNames && toolNames.length > 0) {
        // 2-1. 조리도구 이름 배열로 조리도구 ID 배열 찾기 (없으면 새로 생성)
        const toolIds = await this.findOrCreateByName(toolNames, connection);
        
        // 2-2. user_tools 테이블에 새로운 정보 삽입
        const values = toolIds.map(toolId => [userId, toolId]);
        await connection.query('INSERT INTO user_tools (user_id, tool_id) VALUES ?', [values]);
      }

      await connection.commit(); // 모든 작업이 성공했으면 커밋
      
    } catch (error) {
      await connection.rollback(); // 하나라도 실패하면 롤백
      console.error('updateUserTools 트랜잭션 오류:', error);
      throw error; // 에러를 컨트롤러로 전파
    } finally {
      connection.release(); // 커넥션 반환
    }
  }

  // 조리도구 이름 배열을 받아 ID 배열을 반환하는 헬퍼 메서드
  // (트랜잭션 내에서 동일한 커넥션을 사용해야 함)
  static async findOrCreateByName(names, connection) {
    const toolIds = [];
    for (const name of names) {
      // 이미 존재하는지 확인
      let [rows] = await connection.execute('SELECT id FROM tools WHERE name = ?', [name]);
      
      let toolId;
      if (rows.length > 0) {
        // 존재하면 해당 ID 사용
        toolId = rows[0].id;
      } else {
        // 존재하지 않으면 tools 마스터 테이블에 새로 추가
        const [result] = await connection.execute('INSERT INTO tools (name) VALUES (?)', [name]);
        toolId = result.insertId;
      }
      toolIds.push(toolId);
    }
    return toolIds;
  }

  // 사용자별 조리도구 조회
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT t.name 
        FROM tools t
        INNER JOIN user_tools ut ON t.id = ut.tool_id
        WHERE ut.user_id = ?
      `;
      const [rows] = await pool.execute(query, [userId]);
      return rows.map(row => row.name);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  Tool,
  ToolRepository
};
