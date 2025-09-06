// User 모델 - MySQL 연동
const { pool } = require('../config/database');

class User {
  constructor(data) {
    this.id = data.id;
    this.nickname = data.nickname;
    this.userID = data.userID;
    this.userPW = data.userPW;
    this.createdAt = data.createdAt;
  }

  // 사용자 정보를 JSON으로 변환 (비밀번호 제외)
  toJSON() {
    return {
      id: this.id,
      nickname: this.nickname,
      userID: this.userID,
      createdAt: this.createdAt
    };
  }
}

// MySQL 기반 사용자 저장소
class UserRepository {
  // 사용자 테이블 생성
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        userID VARCHAR(50) UNIQUE NOT NULL,
        userPW VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    try {
      await pool.execute(createTableQuery);
      console.log('✅ users 테이블이 준비되었습니다.');
    } catch (error) {
      console.error('❌ users 테이블 생성 실패:', error.message);
      throw error;
    }
  }

  // 사용자 생성
  static async create(nickname, userID, userPW) {
    try {
      // 중복 아이디 확인
      const existingUser = await this.findByUserID(userID);
      if (existingUser) {
        throw new Error('이미 존재하는 아이디입니다.');
      }

      const insertQuery = `
        INSERT INTO users (nickname, userID, userPW) 
        VALUES (?, ?, ?)
      `;
      
      const [result] = await pool.execute(insertQuery, [nickname, userID, userPW]);
      
      // 생성된 사용자 정보 조회
      const newUser = await this.findById(result.insertId);
      return newUser;
    } catch (error) {
      throw error;
    }
  }

  // ID로 사용자 찾기
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ?';
      const [rows] = await pool.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return new User(rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // 아이디로 사용자 찾기
  static async findByUserID(userID) {
    try {
      const query = 'SELECT * FROM users WHERE userID = ?';
      const [rows] = await pool.execute(query, [userID]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return new User(rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // 로그인 검증
  static async authenticate(userID, userPW) {
    try {
      const user = await this.findByUserID(userID);
      if (user && user.userPW === userPW) {
        return user;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  // 모든 사용자 조회 (개발용)
  static async findAll() {
    try {
      const query = 'SELECT id, nickname, userID, createdAt FROM users';
      const [rows] = await pool.execute(query);
      
      return rows.map(row => ({
        id: row.id,
        nickname: row.nickname,
        userID: row.userID,
        createdAt: row.createdAt
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  User,
  UserRepository
};
