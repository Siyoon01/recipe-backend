// 파일 경로: src/utils/errorHandler.js

/**
 * 설계된 result_code 표에 맞는 코드인지 확인하고, 없으면 400으로 통일합니다.
 * 
 * 허용된 코드:
 * - 200: 정상 처리 (성공, DELETE, PUT, GET)
 * - 201: 정상 생성(성공, POST)
 * - 202: 요청 접수됨(처리 중)
 * - 400: 잘못된 요청
 * - 401: 인증 실패
 * - 403: 권한 없음
 * - 404: 리소스를 찾을 수 없음
 * - 409: 충돌 발생
 * - 413: 요청 본문이 너무 큼
 * - 500: 내부 서버 오류
 * - 601: 허용되지 않은 값 입력
 * - 602: 재고 부족
 * - 603: 이미지 분석 실패
 */
const ALLOWED_ERROR_CODES = [400, 401, 403, 404, 409, 413, 500, 601, 602, 603];

/**
 * 에러 코드가 설계 표에 있는지 확인하고, 없으면 400을 반환합니다.
 * @param {number} code - 에러 코드
 * @returns {number} - 허용된 코드이면 그대로, 아니면 400
 */
function normalizeErrorCode(code) {
    if (!code || typeof code !== 'number') {
        return 400; // 코드가 없거나 숫자가 아니면 400
    }
    
    if (ALLOWED_ERROR_CODES.includes(code)) {
        return code; // 허용된 코드면 그대로 반환
    }
    
    return 400; // 표에 없는 코드는 400으로 통일
}

module.exports = {
    normalizeErrorCode
};

