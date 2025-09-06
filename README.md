# Recipe Backend API

레시피 프로젝트의 백엔드 API 서버입니다.

## 🚀 시작하기

### 필수 요구사항
- Node.js (v14 이상)
- MySQL (v8.0 이상)

### 설치 및 실행

1. **의존성 설치**
```bash
npm install
```

2. **환경변수 설정**
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=recipe_db
DB_PORT=3306
PORT=3001
```

3. **MySQL 데이터베이스 생성**
```sql
CREATE DATABASE recipe_db;
```

4. **서버 실행**
```bash
npm start
# 또는 개발 모드
npm run dev
```

## 📡 API 엔드포인트

### 회원가입
- **POST** `/api/signup`
- **요청 데이터**: 
```json
{
  "nickname": "닉네임",
  "userID": "아이디",
  "userPW": "비밀번호"
}
```

### 로그인
- **POST** `/api/login`
- **요청 데이터**:
```json
{
  "userID": "아이디",
  "userPW": "비밀번호"
}
```

## 🗂️ 프로젝트 구조

```
backend/
├── config/
│   └── database.js      # 데이터베이스 설정
├── controllers/
│   └── authController.js # 인증 컨트롤러
├── models/
│   └── User.js          # 사용자 모델
├── routes/
│   └── authRoutes.js    # 인증 라우트
├── app.js               # Express 앱 설정
├── server.js            # 서버 시작 파일
└── package.json
```

## 🔧 기술 스택

- **Node.js** + **Express.js**
- **MySQL** + **mysql2**
- **CORS** (프론트엔드 연동)
- **MVC 패턴**

## 📝 개발자 정보

P_Project 팀 - 백엔드 개발
