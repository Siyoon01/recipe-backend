// 파일 경로: src/workers/ai/aiProcess.js
// AI 모델을 Child Process로 실행하는 모듈

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

// AI 스크립트 경로 (Python 스크립트 또는 다른 실행 파일)
// aiProcess.js 위치: project/src/workers/aiProcess.js
// ai_test 위치: 프로젝트 루트/ai_test
// 따라서: __dirname (workers) -> .. (src) -> .. (project) -> .. (루트) -> ai_test
const AI_SCRIPT_PATH = process.env.AI_SCRIPT_PATH || path.join(__dirname, '..', '..', '..', 'ai_test');
const PYTHON_COMMAND = process.env.PYTHON_COMMAND || '/opt/homebrew/bin/python3';

/**
 * 이미지 분석을 위한 AI 프로세스 실행
 * @param {number} userId - 사용자 ID
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {Promise<Object>} AI 분석 결과 { success, message, result_code, detections }
 */
async function runImageAnalysis(userId, imagePath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const scriptPath = path.join(AI_SCRIPT_PATH, 'ObjectDetect.py');

    logger.info('[AI:cv]', `이미지 분석 프로세스 시작: ${scriptPath}`);
    logger.info('[AI:cv]', `파라미터: userId=${userId}, imagePath=${imagePath}`);

    // 이미지 파일을 바이너리로 읽기
    let imageBytes;
    try {
      imageBytes = fs.readFileSync(imagePath);
      logger.info('[AI:cv]', `이미지 파일 읽기 완료: ${imageBytes.length} bytes`);
    } catch (readError) {
      logger.error('[AI:cv]', `이미지 파일 읽기 실패: ${readError.message}`);
      reject({
        message: `이미지 파일을 읽을 수 없습니다: ${readError.message}`,
        code: 500
      });
      return;
    }

    const pythonProcess = spawn(PYTHON_COMMAND, [scriptPath], {
      cwd: AI_SCRIPT_PATH,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // 표준 출력 수집
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // 표준 에러 수집
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 이미지 바이너리 데이터를 stdin으로 전송
    pythonProcess.stdin.on('error', (err) => {
      // EPIPE 오류는 프로세스가 종료된 경우 발생할 수 있으므로 무시
      if (err.code !== 'EPIPE') {
        logger.error('[AI:cv]', `stdin 쓰기 오류: ${err.message}`);
      }
    });
    
    pythonProcess.stdin.write(imageBytes, (err) => {
      if (err && err.code !== 'EPIPE') {
        logger.error('[AI:cv]', `이미지 데이터 전송 오류: ${err.message}`);
      }
    });
    pythonProcess.stdin.end();

    // 프로세스 종료 처리
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error('[AI:cv]', `프로세스 종료 코드: ${code}, stderr: ${stderr}`);
        reject({
          message: stderr || '이미지 분석 중 오류가 발생했습니다.',
          code: 500
        });
        return;
      }

      try {
        // JSON 응답 파싱
        const result = JSON.parse(stdout.trim());
        // statusCode를 result_code로 변환 (기존 API 스펙과 호환)
        if (result.statusCode) {
          result.result_code = result.statusCode;
        }
        logger.info('[AI:cv]', '이미지 분석 완료');
        resolve(result);
      } catch (parseError) {
        logger.error('[AI:cv]', `응답 파싱 실패: ${parseError.message}, stdout: ${stdout}`);
        reject({
          message: 'AI 응답을 파싱할 수 없습니다.',
          code: 500
        });
      }
    });

    // 프로세스 에러 처리
    pythonProcess.on('error', (error) => {
      logger.error('[AI:cv]', `프로세스 실행 실패: ${error.message}`);
      reject({
        message: `AI 프로세스를 실행할 수 없습니다: ${error.message}`,
        code: 500
      });
    });

    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      logger.error('[AI:cv]', '이미지 분석 타임아웃 (30초)');
      reject({
        message: '이미지 분석이 시간 초과되었습니다.',
        code: 500
      });
    }, 30000);

    pythonProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * 레시피 추천을 위한 AI 프로세스 실행
 * @param {Object} params - 추천 요청 파라미터
 * @param {number} params.userId - 사용자 ID
 * @param {Array<number>} params.ownedIngredientIds - 보유 식재료 마스터 ID 배열
 * @param {Object} params.query - 검색 쿼리
 * @param {string} params.query.queryText - 검색 텍스트
 * @param {Array<number>} params.query.selectedIngredientIds - 선택된 식재료 마스터 ID 배열
 * @param {boolean} params.requireMain - 주재료 필수 여부
 * @param {Array<Object>} params.candidates - 필터링된 레시피 후보 배열
 * @returns {Promise<Object>} AI 추천 결과 { success, message, result_code, recommendations }
 */
async function runRecipeRecommendation(params) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(AI_SCRIPT_PATH, 'recsys_infer.py');
    const inputData = JSON.stringify(params);

    logger.info('[AI:recsys]', `레시피 추천 프로세스 시작: ${scriptPath}`);
    logger.info('[AI:recsys]', `파라미터: userId=${params.userId}`);

    const pythonProcess = spawn(PYTHON_COMMAND, [scriptPath], {
      cwd: AI_SCRIPT_PATH,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // 표준 출력 수집
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // 표준 에러 수집
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 입력 데이터 전송 (stdin)
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();

    // 프로세스 종료 처리
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error('[AI:recsys]', `프로세스 종료 코드: ${code}, stderr: ${stderr}`);
        reject({
          message: stderr || '레시피 추천 중 오류가 발생했습니다.',
          code: 500
        });
        return;
      }

      try {
        // JSON 응답 파싱
        const result = JSON.parse(stdout.trim());
        logger.info('[AI:recsys]', '레시피 추천 완료');
        resolve(result);
      } catch (parseError) {
        logger.error('[AI:recsys]', `응답 파싱 실패: ${parseError.message}, stdout: ${stdout}`);
        reject({
          message: 'AI 응답을 파싱할 수 없습니다.',
          code: 500
        });
      }
    });

    // 프로세스 에러 처리
    pythonProcess.on('error', (error) => {
      logger.error('[AI:recsys]', `프로세스 실행 실패: ${error.message}`);
      reject({
        message: `AI 프로세스를 실행할 수 없습니다: ${error.message}`,
        code: 500
      });
    });

    // 타임아웃 설정 (30초)
    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      logger.error('[AI:recsys]', '레시피 추천 타임아웃 (30초)');
      reject({
        message: '레시피 추천이 시간 초과되었습니다.',
        code: 500
      });
    }, 30000);

    pythonProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

module.exports = {
  runImageAnalysis,
  runRecipeRecommendation
};

