// 파일 경로: src/models/RecommendationLog.model.js

const { pool } = require('../../server');

// --- 1. 추천 기록 저장소 (Repository) ---
class RecommendationLogRepository {

    /**
     * POST /api/recipes/recommend
     * 추천된 레시피 목록을 받아 로그 테이블에 기록합니다. (일괄 삽입)
     * @param {number} userId - 추천을 받은 사용자 ID
     * @param {number[]} recipeIds - 추천된 레시피 ID 배열
     */
    static async createBulkLog(userId, recipeIds) {
        if (!recipeIds || recipeIds.length === 0) return 0;
        
        // (userId, recipeId) 쌍의 배열을 만듭니다.
        const values = recipeIds.map(recipeId => [userId, recipeId]);

        try {
            const insertQuery = `
                INSERT INTO recommendation_logs (user_id, recipe_id) 
                VALUES ?
            `;
            // pool.query를 사용하여 VALUES 배열을 효율적으로 삽입합니다.
            const [result] = await pool.query(insertQuery, [values]); 
            
            return result.affectedRows;
        } catch (error) {
            console.error('RecommendationLogRepository.createBulkLog 오류:', error);
            const err = new Error('추천 기록 저장 중 DB 오류가 발생했습니다.');
            err.code = 500;
            throw err;
        }
    }

    /**
     * GET /api/admin/stats/recipes
     * 관리자 통계를 위해 최다 추천된 레시피 목록을 조회합니다.
     * @param {number} limit - 상위 몇 개를 조회할지 제한
     */
    static async getRecommendationStats(limit = 10) {
        try {
            // DB에서 추천 횟수를 계산하고 레시피 제목과 함께 상위 랭킹을 조회합니다.
            const query = `
                SELECT 
                    rl.recipe_id, 
                    r.title,
                    COUNT(rl.id) AS recommendation_count
                FROM recommendation_logs rl
                JOIN recipes r ON rl.recipe_id = r.id
                GROUP BY rl.recipe_id, r.title
                ORDER BY recommendation_count DESC
                LIMIT ?;
            `;
            const [rows] = await pool.execute(query, [limit]);
            
            // 결과 배열을 { recipeId, title, recommendation_count } 형태로 반환
            return rows.map(row => ({
                recipeId: row.recipe_id,
                title: row.title,
                recommendationCount: row.recommendation_count,
            }));
            
        } catch (error) {
            console.error('RecommendationLogRepository.getRecommendationStats 오류:', error);
            const err = new Error('추천 통계 조회 중 오류가 발생했습니다.');
            err.code = 500;
            throw err;
        }
    }
}

module.exports = {
    RecommendationLogRepository
};