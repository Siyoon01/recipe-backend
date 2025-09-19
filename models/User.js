// 파일 경로 : P_Project/backend/models/User.js

const { pool } = require('../config/database');
const bcrypt = require('bcrypt'); // bcrypt 라이브러리 추가

class User {
  constructor(data) {
    this.id = data.id;
    this.nickname = data.nickname;
    this.userID = data.userID;
    this.userPW = data.userPW; // DB에 저장된 해시값을 가리킴
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
  // 사용자 테이블 생성 (변경 없음)
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

  // 사용자 생성 (★★★ 변경된 부분 ★★★)
  static async create(nickname, userID, userPW) {
    try {
      // 중복 아이디 확인
      const existingUser = await this.findByUserID(userID);
      if (existingUser) {
        throw new Error('이미 존재하는 아이디입니다.');
      }

      // --- 비밀번호 해싱 시작 ---
      const saltRounds = 10; // 해싱 복잡도, 10-12가 일반적
      const hashedPassword = await bcrypt.hash(userPW, saltRounds);
      // --- 비밀번호 해싱 끝 ---

      const insertQuery = `
        INSERT INTO users (nickname, userID, userPW) 
        VALUES (?, ?, ?)
      `;
      
      // 해싱된 비밀번호(hashedPassword)를 DB에 저장
      const [result] = await pool.execute(insertQuery, [nickname, userID, hashedPassword]);
      
      const newUser = await this.findById(result.insertId);
      return newUser;
    } catch (error) {
      throw error;
    }
  }

  // ID로 사용자 찾기 (변경 없음)
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

  // 아이디로 사용자 찾기 (변경 없음)
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

  // 로그인 검증 (★★★ 변경된 부분 ★★★)
  static async authenticate(userID, userPW) {
    try {
      const user = await this.findByUserID(userID);
      
      // 사용자가 존재하지 않으면 null 반환
      if (!user) {
        return null;
      }

      // --- 비밀번호 비교 시작 ---
      // 입력된 비밀번호(userPW)와 DB에 저장된 해시(user.userPW)를 비교
      const match = await bcrypt.compare(userPW, user.userPW);
      // --- 비밀번호 비교 끝 ---

      if (match) {
        return user; // 비밀번호 일치
      }

      return null; // 비밀번호 불일치
    } catch (error) {
      throw error;
    }
  }

  // 모든 사용자 조회 (변경 없음)
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