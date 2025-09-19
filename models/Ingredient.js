// 식재료 모델 - MySQL 연동
const { pool } = require('../config/database');

class Ingredient {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.name = data.name;
    this.expiryDate = data.expiryDate;
    this.quantity = data.quantity;
    this.createdAt = data.createdAt;
  }

  // 식재료 정보를 JSON으로 변환
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      name: this.name,
      expiryDate: this.expiryDate,
      quantity: this.quantity,
      createdAt: this.createdAt
    };
  }
}

// MySQL 기반 식재료 저장소
class IngredientRepository {
  // 식재료 테이블 생성 (기존 테이블 삭제 후 재생성)
  static async createTable() {
    try {
      // 기존 테이블 삭제
      await pool.execute('DROP TABLE IF EXISTS ingredients');
      console.log('🗑️ 기존 ingredients 테이블 삭제됨');
      
      // 새로운 테이블 생성
      const createTableQuery = `
        CREATE TABLE ingredients (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          expiryDate DATE NOT NULL,
          quantity VARCHAR(50) NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      await pool.execute(createTableQuery);
      console.log('✅ 새로운 ingredients 테이블이 준비되었습니다.');
    } catch (error) {
      console.error('❌ ingredients 테이블 생성 실패:', error.message);
      throw error;
    }
  }

  // 식재료 생성
  static async create(user_id, name, expiryDate, quantity) {
    try {
      const insertQuery = `
        INSERT INTO ingredients (user_id, name, expiryDate, quantity) 
        VALUES (?, ?, ?, ?)
      `;
      
      const [result] = await pool.execute(insertQuery, [user_id, name, expiryDate, quantity]);
      
      // 생성된 식재료 정보 조회
      const newIngredient = await this.findById(result.insertId);
      return newIngredient;
    } catch (error) {
      throw error;
    }
  }

  // ID로 식재료 찾기
  static async findById(id) {
    try {
      const query = 'SELECT * FROM ingredients WHERE id = ?';
      const [rows] = await pool.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return new Ingredient(rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // 사용자별 식재료 조회
  static async findByUserId(user_id) {
    try {
      const query = 'SELECT * FROM ingredients WHERE user_id = ? ORDER BY createdAt DESC';
      const [rows] = await pool.execute(query, [user_id]);
      
      return rows.map(row => new Ingredient(row));
    } catch (error) {
      throw error;
    }
  }

  // 식재료 수정
  static async update(id, name, expiryDate, quantity) {
    try {
      const updateQuery = `
        UPDATE ingredients 
        SET name = ?, expiryDate = ?, quantity = ? 
        WHERE id = ?
      `;
      
      await pool.execute(updateQuery, [name, expiryDate, quantity, id]);
      
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  // 식재료 삭제
  static async delete(id) {
    try {
      const deleteQuery = 'DELETE FROM ingredients WHERE id = ?';
      const [result] = await pool.execute(deleteQuery, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 모든 식재료 조회 (개발용)
  static async findAll() {
    try {
      const query = 'SELECT * FROM ingredients ORDER BY createdAt DESC';
      const [rows] = await pool.execute(query);
      
      return rows.map(row => new Ingredient(row));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  Ingredient,
  IngredientRepository
};
