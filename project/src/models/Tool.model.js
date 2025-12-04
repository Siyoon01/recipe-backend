// 파일 경로: src/models/Tool.model.js

const { pool } = require('../../server');

// --- 0. 마스터 데이터 (하드코딩된 허용 목록) ---
const ALLOWED_TOOLS = [
  '냄비', '프라이팬', '볼', '계량스푼', '키친타올', '계량컵', '전자레인지', 
  '에어프라이어', '오븐', '찜기', '내열용기', '밀폐용기', '믹서기', '거품기', 
  '스텐트레이', '랩', '매셔', '전기밥솥', '면보', '체망', '토치'
];


// --- 1. 조리도구 데이터 클래스 ---
class Tool {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

// --- 2. 조리도구 저장소 (Repository) ---
class ToolRepository {

  /**
   * 전체 허용 목록을 반환합니다. (Controller에서 사용)
   */
  static getAllowedTools() {
    return ALLOWED_TOOLS;
  }

  /**
   * 조리도구 이름 배열을 허용 목록과 비교하여 유효성을 검사합니다.
   * @throws {Error} 400 Bad Request
   */
  static validateToolNames(toolNames) {
    const invalidTools = toolNames.filter(name => !ALLOWED_TOOLS.includes(name));
    
    if (invalidTools.length > 0) {
      const error = new Error(`허용되지 않은 조리도구입니다: ${invalidTools.join(', ')}`);
      error.code = 601; // 601: 허용되지 않은 값 입력
      throw error;
    }
  }

  /**
   * 유효성이 검증된 조리도구 이름 배열을 받아 해당 ID 배열을 DB에서 조회합니다.
   */
  static async findIdsByNames(names, connection = pool) {
    if (names.length === 0) return [];
    
    const placeholders = names.map(() => '?').join(','); 
    
    // DB에서 이름으로 ID를 조회
    const [rows] = await connection.query(`SELECT id FROM tools WHERE name IN (${placeholders})`, names);
    
    // DB에 데이터가 누락된 경우 (마스터 테이블에 등록되지 않은 경우) 오류 처리
    if (rows.length !== names.length) {
       const error = new Error("DB 마스터 테이블에 등록되지 않은 조리도구 정보가 포함되어 있습니다.");
       error.code = 500; // 500 Internal Server Error
       throw error;
    }

    return rows.map(row => row.id);
  }

  /**
   * PUT /api/profile/tools
   * 사용자의 조리도구 정보를 업데이트합니다. (기존 정보 삭제 후 새 정보 삽입 - 트랜잭션)
   */
  static async updateUserTools(userId, toolNames) {
    // 1. 입력값 유효성 검증
    this.validateToolNames(toolNames);
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction(); // 트랜잭션 시작

      // 2. 기존 조리도구 정보 모두 삭제 (Full Replacement)
      await connection.execute('DELETE FROM user_tools WHERE user_id = ?', [userId]);

      // 3. 새로운 조리도구 정보가 있다면, 처리
      if (toolNames.length > 0) {
        // 3-1. 조리도구 이름으로 ID 배열 조회
        const toolIds = await this.findIdsByNames(toolNames, connection);
        
        // 3-2. user_tools 테이블에 새로운 정보 삽입 (bulk insert)
        const values = toolIds.map(toolId => [userId, toolId]);
        await connection.query('INSERT INTO user_tools (user_id, tool_id) VALUES ?', [values]);
      }

      await connection.commit(); // 모든 작업이 성공했으면 커밋
      
    } catch (error) {
      await connection.rollback(); // 실패 시 롤백
      console.error('updateUserTools 트랜잭션 오류:', error);
      // Repository에서 throw된 오류를 포함하여 재throw
      throw error; 
    } finally {
      connection.release(); // 커넥션 반환
    }
  }

  /**
   * GET /api/profile/tools
   * 사용자 ID에 해당하는 조리도구 목록을 조회합니다.
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT t.id, t.name 
        FROM tools t
        INNER JOIN user_tools ut ON t.id = ut.tool_id
        WHERE ut.user_id = ?
        ORDER BY t.name ASC
      `;
      const [rows] = await pool.execute(query, [userId]);
      
      // { id, name } 객체의 배열 반환
      return rows; 
    } catch (error) {
      console.error('findByUserId 오류:', error);
      const err = new Error('조리도구 목록 조회 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }
}

module.exports = {
  ToolRepository,
  Tool 
};