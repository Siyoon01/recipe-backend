// 파일 경로: src/middleware/upload.middleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 프로젝트 루트에서 'uploads/analysis_images' 폴더의 절대 경로를 계산합니다.
// __dirname (src/middleware) -> '..' (src) -> '..' (project root) -> 'uploads/analysis_images'
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'analysis_images');

// 1. 업로드 디렉토리가 없으면 생성 (필수)
if (!fs.existsSync(UPLOAD_DIR)) {
    console.log(`[INIT] Creating upload directory: ${UPLOAD_DIR}`);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 2. Multer 로컬 디스크 스토리지 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 파일을 UPLOAD_DIR 경로에 저장
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // 파일 이름 설정: 원본 이름 + 타임스탬프 + 확장자 (중복 방지)
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        // 최종 파일명: [원본이름]-[현재시간][확장자]
        cb(null, `${name}-${Date.now()}${ext}`);
    }
});

// 3. Multer 미들웨어 인스턴스 정의
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 파일 크기 제한 (5MB)
    fileFilter: (req, file, cb) => {
        // 이미지 파일만 허용 (선택적)
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            // 400 Bad Request 에러 발생 (잘못된 파일 형식)
            cb(new Error('허용되지 않은 파일 형식입니다. 이미지 파일만 업로드 가능합니다.', 400), false);
        }
    }
});

module.exports = upload;