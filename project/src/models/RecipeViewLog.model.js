// 파일 경로: src/models/RecipeViewLog.model.js

const { pool } = require('../../server');

// --- 1. 조회 기록 저장소 (Repository) ---
class RecipeViewLogRepository {

    /**
     * POST /api/recipes/:id/view
     * 레시피 조회 기록을 생성합니다. (조회 시점 기록)
     */
    static async createLog(userId, recipeId) {
        try {
            const insertQuery = `
                INSERT INTO recipe_view_logs (user_id, recipe_id) 
                VALUES (?, ?)
            `;
            const [result] = await pool.execute(insertQuery, [userId, recipeId]);
            
            return result.insertId;
        } catch (error) {
            console.error('RecipeViewLogRepository.createLog 오류:', error);
            const err = new Error('조회 기록 저장 중 DB 오류가 발생했습니다.');
            err.code = 500;
            throw err;
        }
    }

    /**
     * GET /api/recipes/history 구현을 위해
     * 특정 사용자의 최근 조회 기록을 레시피 정보와 함께 조회합니다.
     * (중복 제거 및 최종 조회 시간 기준으로 정렬)
     */
    static async findDistinctRecentViews(userId, limit = 10) {
        try {
            // NOTE: 중복 조회 레시피 중 가장 최근 조회된 시간(MAX(viewed_at))을 기준으로 정렬
            const query = `
                SELECT 
                    r.id AS id, 
                    r.title,
                    r.main_image_url,
                    MAX(rvl.viewed_at) AS last_viewed_at
                FROM recipe_view_logs rvl
                JOIN recipes r ON rvl.recipe_id = r.id
                WHERE rvl.user_id = ?
                GROUP BY rvl.recipe_id, r.title, r.main_image_url
                ORDER BY last_viewed_at DESC
                LIMIT ?;
            `;
            // NOTE: RecipeViewLogRepository는 RecipeRepository에서 호출되어 사용됨
            const [rows] = await pool.execute(query, [userId, limit]);
            
            return rows;
        } catch (error) {
            console.error('RecipeViewLogRepository.findDistinctRecentViews 오류:', error);
            const err = new Error('조회 기록 목록 생성 중 오류가 발생했습니다.');
            err.code = 500;
            throw err;
        }
    }
}

module.exports = {
    RecipeViewLogRepository
};