// 파일 경로: src/models/IngredientMaster.model.js

const { pool } = require('../../server');

// --- 1. 마스터 재료 데이터 클래스 ---
class IngredientMaster {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

// --- 2. 마스터 재료 저장소 (Repository) ---
class IngredientMasterRepository {

  /**
   * 재료 이름을 기준으로 마스터 테이블에서 재료를 조회합니다.
   */
  static async findByName(name, connection = pool) {
    try {
      const query = 'SELECT id, name FROM ingredients_master WHERE name = ?';
      const [rows] = await connection.execute(query, [name]);
      
      return rows.length === 0 ? null : new IngredientMaster(rows[0]);
    } catch (error) {
      console.error('IngredientMasterRepository.findByName 오류:', error);
      const err = new Error('마스터 재료 조회 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }
  
  /**
   * 재료 이름으로 조회하고, 없으면 새로 생성 후 ID를 반환합니다.
   * (Recipe 수정 시 새로운 재료가 필요한 경우 사용될 수 있음)
   * @param {string} name - 재료 이름
   * @param {object} connection - DB 연결 (트랜잭션용, 선택사항)
   * @returns {Promise<number>} ingredient_master_id
   */
  static async findOrCreateByName(name, connection = pool) {
    try {
      // 1. 기존 재료 조회
      let ingredient = await this.findByName(name, connection);
      
      if (ingredient) {
        return ingredient.id;
      }

      // 2. 없으면 새로 생성 (UNIQUE 제약 조건이 있으므로 여기서 실패할 수 있음)
      const insertQuery = 'INSERT INTO ingredients_master (name) VALUES (?)';
      const [result] = await connection.execute(insertQuery, [name]);
      
      return result.insertId;

    } catch (error) {
      console.error('IngredientMasterRepository.findOrCreateByName 오류:', error);
      const err = new Error('마스터 재료 생성 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }

  /**
   * ID 목록을 기준으로 마스터 재료 목록을 조회합니다.
   * (Recipe 상세 조회 시 required_ingredients를 구성할 때 사용)
   */
  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT id, name FROM ingredients_master WHERE id IN (${placeholders})`;
    
    try {
      const [rows] = await pool.execute(query, ids);
      return rows.map(row => new IngredientMaster(row));
    } catch (error) {
      console.error('IngredientMasterRepository.findByIds 오류:', error);
      const err = new Error('마스터 재료 목록 조회 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }
  
  /**
   * 모든 마스터 재료 목록을 조회합니다. (관리자 기능 확장 시 사용)
   */
  static async getAll() {
    try {
      const query = 'SELECT id, name FROM ingredients_master ORDER BY name ASC';
      const [rows] = await pool.execute(query);
      
      return rows.map(row => new IngredientMaster(row));
    } catch (error) {
      console.error('IngredientMasterRepository.getAll 오류:', error);
      const err = new Error('전체 마스터 재료 목록 조회 중 오류가 발생했습니다.');
      err.code = 500;
      throw err;
    }
  }
}

module.exports = {
  IngredientMasterRepository,
  IngredientMaster
};