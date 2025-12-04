// 파일 경로: src/models/ImageAnalysis.model.js

const { pool } = require('../../server'); // server.js가 root에 있으므로 상대 경로 사용

// --- 1. 이미지 분석 저장소 (Repository) ---
class ImageAnalysisRepository {

    /**
     * POST /api/images/upload
     * 이미지 업로드 후 초기 분석 데이터를 생성합니다. (상태: PENDING)
     */
    static async create({ userId, image_url, original_filename }) {
        try {
            const query = `
                INSERT INTO image_analyses (user_id, image_url, original_filename) 
                VALUES (?, ?, ?)
            `;
            const [result] = await pool.execute(query, [userId, image_url, original_filename]);

            // 생성된 데이터 다시 조회해서 반환
            return this.findById(result.insertId);
        } catch (error) {
            console.error('ImageAnalysisRepository.create 오류:', error);
            const err = new Error(error.message || '이미지 분석 기록 생성에 실패했습니다.');
            err.code = 500;
            throw err;
        }
    }

    /**
     * GET /api/images/analysis/:id
     * ID로 특정 분석 데이터를 조회합니다.
     */
    static async findById(id) {
        try {
            const [rows] = await pool.execute('SELECT * FROM image_analyses WHERE id = ?', [id]);
            return rows[0] || null; // 조회된 원시 데이터 객체 반환
        } catch (error) {
            console.error('ImageAnalysisRepository.findById 오류:', error);
            const err = new Error(error.message || '분석 기록 조회 중 DB 오류가 발생했습니다.');
            err.code = 500;
            throw err;
        }
    }
    
    /**
     * 분석 상태 필드(status)를 업데이트합니다. (PROCESSING, PENDING 등으로 변경 시 사용)
     */
    static async updateStatus(id, newStatus) {
        try {
            const query = "UPDATE image_analyses SET status = ? WHERE id = ?";
            await pool.execute(query, [newStatus, id]);
        } catch (error) {
            console.error('ImageAnalysisRepository.updateStatus 오류:', error);
            throw error;
        }
    }

    /**
     * 분석 상태를 'COMPLETED'로 업데이트하고 결과를 저장합니다.
     * (AI 서버가 분석 결과를 반환했을 때 호출)
     */
    static async updateAsCompleted(id, identifiedIngredients) {
        try {
            const query = `
                UPDATE image_analyses 
                SET status = 'completed', identified_ingredients = ?, analyzed_at = NOW() 
                WHERE id = ?
            `;
            // identifiedIngredients (Array)를 JSON 문자열로 변환하여 저장
            await pool.execute(query, [JSON.stringify(identifiedIngredients), id]);
        } catch (error) {
            console.error('ImageAnalysisRepository.updateAsCompleted 오류:', error);
            throw error;
        }
    }

    /**
     * 분석 상태를 'FAILED'로 업데이트하고 에러 메시지를 저장합니다.
     * (AI 서버 통신 실패 또는 분석 결과 실패 시 호출)
     */
    static async updateAsFailed(id, errorMessage) {
        try {
            const query = `
                UPDATE image_analyses 
                SET status = 'failed', error_message = ?, analyzed_at = NOW() 
                WHERE id = ?
            `;
            await pool.execute(query, [errorMessage, id]);
        } catch (error) {
            console.error('ImageAnalysisRepository.updateAsFailed 오류:', error);
            throw error;
        }
    }
    
    // NOTE: findByUserId 함수는 현재 API 명세에는 필요하지 않으나, 확장성을 위해 생략함.
}

module.exports = { ImageAnalysisRepository };