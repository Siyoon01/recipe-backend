// 파일 경로: src/models/Recipe.model.js

const { pool } = require('../../server');
const { getRecipeImageUrl } = require('../utils/recipeImagePath');

// 레시피 세부 구성 요소를 위한 내부 모델 임포트 가정
const { IngredientMasterRepository } = require('./IngredientMaster.model');
const { RecipeViewLogRepository } = require('./RecipeViewLog.model');
const { RecommendationLogRepository } = require('./RecommendationLog.model');
// RecipeSteps, RecipeIngredients 레포지토리는 여기서 로직을 수행한다고 가정

// --- 1. 레시피 데이터 클래스 ---
class Recipe {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.main_image_url = data.main_image_url;
        this.view_count = data.view_count;
    }
    
    // 복합 JSON 객체 생성을 위한 메서드
    static async createDetailResponse(recipe, ingredients, steps) {
        // 이 함수는 findById 로직 끝에서 상세 JSON 구조를 만들 때 사용됩니다.
        // Array of Objects를 반환합니다.
        return {
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            main_image_url: recipe.main_image_url,
            // ... 기타 기본 필드
            required_ingredients: ingredients, // Array of { name, quantity }
            steps: steps                     // Array of { step_number, description, image_url }
        };
    }
}

// --- 2. 레시피 저장소 (Repository) ---
class RecipeRepository {

    /**
     * (내부 헬퍼) 레시피의 재료, 단계 정보를 트랜잭션 내에서 일괄 덮어씁니다.
     * @param {*} connection - 활성화된 DB 연결
     * @param {number} recipeId
     * @param {object} details - required_ingredients, steps를 포함
     */
    static async _updateDetailsInTransaction(connection, recipeId, details) {
        // 1. 기존 재료 삭제 후 삽입 (recipe_ingredients)
        await connection.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
        if (details.required_ingredients && details.required_ingredients.length > 0) {
            // required_ingredients는 { name, quantity } 형식으로 들어옴
            // name으로 ingredient_master_id를 찾거나 생성 (트랜잭션 내에서 실행)
            const ingredientValues = await Promise.all(
                details.required_ingredients.map(async (ing) => {
                    // 재료 이름으로 마스터 재료 ID 찾기 또는 생성 (트랜잭션 connection 사용)
                    const ingredientMasterId = await IngredientMasterRepository.findOrCreateByName(ing.name, connection);
                    return [recipeId, ingredientMasterId, ing.quantity];
                })
            );
            // NOTE: DB의 ingredients_master 테이블 ID를 참조하는 FK가 유효한지 확인 필요
            await connection.query('INSERT INTO recipe_ingredients (recipe_id, ingredient_master_id, quantity) VALUES ?', [ingredientValues]);
        }
        
        // 2. 기존 단계 삭제 후 삽입 (recipe_steps)
        await connection.execute('DELETE FROM recipe_steps WHERE recipe_id = ?', [recipeId]);
        if (details.steps && details.steps.length > 0) {
            const stepValues = details.steps.map(s => {
                // image_url이 제공되지 않았을 경우 해시 기반 분산 경로 자동 생성
                let imageUrl = s.image_url;
                if (!imageUrl) {
                    imageUrl = getRecipeImageUrl(recipeId, 'step', s.step_number);
                }
                return [recipeId, s.step_number, s.description, imageUrl];
            });
            await connection.query('INSERT INTO recipe_steps (recipe_id, step_number, description, image_url) VALUES ?', [stepValues]);
        }
        // 태그는 PUT Body에서 제외하기로 했으므로, 수정 로직은 여기서 생략합니다.
    }


    /**
     * PUT /api/admin/recipes/:id
     * 레시피의 모든 정보(기본, 재료, 단계)를 일괄 수정합니다. (트랜잭션 사용)
     */
    static async updateFullRecipe(recipeId, fullRecipeData) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1. recipes 테이블 기본 정보 수정
            // main_image_url이 제공되지 않았을 경우 해시 기반 분산 경로 자동 생성
            let mainImageUrl = fullRecipeData.main_image_url;
            if (!mainImageUrl) {
                mainImageUrl = getRecipeImageUrl(recipeId, 'main');
            }
            
            const updateRecipeQuery = `
                UPDATE recipes SET 
                title = ?, description = ?, main_image_url = ?
                WHERE id = ?
            `;
            const [result] = await connection.execute(updateRecipeQuery, [
                fullRecipeData.title, fullRecipeData.description, mainImageUrl, 
                recipeId
            ]);
            
            // 404 처리: 레시피 ID가 없을 경우
            if (result.affectedRows === 0) {
                const err = new Error("수정하려는 레시피를 찾을 수 없습니다.");
                err.code = 404; throw err;
            }

            // 2. 재료 및 단계 상세 정보 일괄 수정/덮어쓰기
            await this._updateDetailsInTransaction(connection, recipeId, fullRecipeData);

            await connection.commit();
            return this.findById(recipeId); 

        } catch (error) {
            await connection.rollback();
            console.error('RecipeRepository.updateFullRecipe 트랜잭션 오류:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
    
    /**
     * GET /api/recipes/:id
     * 레시피 1건의 상세 정보를 조회합니다. (재료, 단계 조인)
     */
    static async findById(recipeId) {
        try {
            // 1. 기본 레시피 정보 조회
            const [recipeRows] = await pool.execute('SELECT * FROM recipes WHERE id = ?', [recipeId]);
            if (recipeRows.length === 0) return null;
            
            const recipe = recipeRows[0];
            
            // 2. 재료 목록 조회
            const [ingRows] = await pool.execute(
                `SELECT im.name, ri.quantity FROM recipe_ingredients ri 
                 JOIN ingredients_master im ON ri.ingredient_master_id = im.id
                 WHERE ri.recipe_id = ?`, [recipeId]);
                 
            // 3. 단계 목록 조회
            const [stepRows] = await pool.execute('SELECT step_number, description, image_url FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number', [recipeId]);

            // 4. 결과 통합하여 API 응답 형식으로 반환
            return Recipe.createDetailResponse(recipe, ingRows, stepRows);

        } catch (error) {
            console.error('RecipeRepository.findById 오류:', error);
            throw error;
        }
    }

    /**
     * GET /api/recipes/recommend API를 위한 상세 정보 목록 조회 (데이터 보강)
     * @param {Array<number>} ids - 레시피 ID 배열
     * @returns {Array<Object>} 레시피 상세 정보 배열
     */
    static async getRecipesByIds(ids) {
        if (!ids || ids.length === 0) return [];
        
        try {
            const placeholders = ids.map(() => '?').join(',');
            
            // 1. 기본 레시피 정보 조회
            const [recipeRows] = await pool.execute(
                `SELECT * FROM recipes WHERE id IN (${placeholders})`, 
                ids
            );
            
            if (recipeRows.length === 0) return [];
            
            // 2. 각 레시피의 재료 목록 조회
            const recipeIds = recipeRows.map(r => r.id);
            const recipePlaceholders = recipeIds.map(() => '?').join(',');
            
            const [ingRows] = await pool.execute(
                `SELECT ri.recipe_id, im.id as ingredient_master_id, im.name, ri.quantity 
                 FROM recipe_ingredients ri 
                 JOIN ingredients_master im ON ri.ingredient_master_id = im.id
                 WHERE ri.recipe_id IN (${recipePlaceholders})
                 ORDER BY ri.recipe_id, ri.ingredient_master_id`,
                recipeIds
            );
            
            // 3. 레시피별로 재료 그룹화
            const ingredientsByRecipe = {};
            ingRows.forEach(ing => {
                if (!ingredientsByRecipe[ing.recipe_id]) {
                    ingredientsByRecipe[ing.recipe_id] = [];
                }
                ingredientsByRecipe[ing.recipe_id].push({
                    id: ing.ingredient_master_id,
                    name: ing.name,
                    quantity: ing.quantity
                });
            });
            
            // 4. 결과 통합
            return recipeRows.map(recipe => ({
                id: recipe.id,
                title: recipe.title,
                description: recipe.description,
                main_image_url: recipe.main_image_url,
                required_ingredients: ingredientsByRecipe[recipe.id] || []
            }));
            
        } catch (error) {
            console.error('RecipeRepository.getRecipesByIds 오류:', error);
            throw error;
        }
    }

    /**
     * 레시피의 재료 ID 목록을 조회합니다.
     * @param {number} recipeId - 레시피 ID
     * @returns {Array<number>} 재료 마스터 ID 배열
     */
    static async getIngredientIdsByRecipeId(recipeId) {
        try {
            const [rows] = await pool.execute(
                'SELECT ingredient_master_id FROM recipe_ingredients WHERE recipe_id = ?',
                [recipeId]
            );
            return rows.map(row => row.ingredient_master_id);
        } catch (error) {
            console.error('RecipeRepository.getIngredientIdsByRecipeId 오류:', error);
            throw error;
        }
    }

    /**
     * 알레르기와 조리도구로 레시피를 필터링합니다.
     * @param {Array<number>} userAllergyIds - 사용자 알레르기 ID 배열
     * @param {Array<number>} userToolIds - 사용자 조리도구 ID 배열
     * @param {Array<number>} ownedIngredientMasterIds - 사용자 보유 식재료 마스터 ID 배열
     * @param {boolean} requireMain - 주재료 필수 여부
     * @param {string} queryText - 검색 키워드 (선택)
     * @returns {Array<Object>} 필터링된 레시피 후보 배열 [{ recipeId, ingredientIds }]
     */
    static async filterRecipesForRecommendation(userAllergyIds, userToolIds, ownedIngredientMasterIds, requireMain, queryText) {
        try {
            let query = `
                SELECT DISTINCT r.id as recipeId
                FROM recipes r
                WHERE 1=1
            `;
            const params = [];
            
            // 키워드 검색 (제목 또는 설명에 포함)
            if (queryText && queryText.trim()) {
                query += ` AND (r.title LIKE ? OR r.description LIKE ?)`;
                const searchTerm = `%${queryText.trim()}%`;
                params.push(searchTerm, searchTerm);
            }
            
            // 알레르기 필터링: 레시피에 포함된 재료 중 사용자 알레르기와 겹치는 것이 있으면 제외
            if (userAllergyIds && userAllergyIds.length > 0) {
                // 사용자 알레르기 이름 목록 조회
                const allergyPlaceholders = userAllergyIds.map(() => '?').join(',');
                const [allergyRows] = await pool.execute(
                    `SELECT name FROM allergies WHERE id IN (${allergyPlaceholders})`,
                    userAllergyIds
                );
                const allergyNames = allergyRows.map(row => row.name);
                
                if (allergyNames.length > 0) {
                    const allergyNamePlaceholders = allergyNames.map(() => '?').join(',');
                    query += `
                        AND r.id NOT IN (
                            SELECT DISTINCT ri.recipe_id 
                            FROM recipe_ingredients ri
                            JOIN ingredients_master im ON ri.ingredient_master_id = im.id
                            WHERE im.name IN (${allergyNamePlaceholders})
                        )
                    `;
                    params.push(...allergyNames);
                }
            }
            
            // 조리도구 필터링: 레시피에 필요한 조리도구 중 사용자가 보유하지 않은 것이 있으면 제외
            // 레시피에 필요한 모든 조리도구가 사용자가 보유한 조리도구 목록에 포함되어야 함
            if (userToolIds && userToolIds.length > 0) {
                const toolPlaceholders = userToolIds.map(() => '?').join(',');
                // 서브쿼리: 레시피에 필요한 조리도구 중 사용자가 보유하지 않은 것이 있는 레시피를 찾음
                query += `
                    AND r.id NOT IN (
                        SELECT rt.recipe_id 
                        FROM recipe_tools rt
                        WHERE rt.tool_id NOT IN (${toolPlaceholders})
                        GROUP BY rt.recipe_id
                    )
                `;
                params.push(...userToolIds);
            } else {
                // 사용자가 조리도구를 하나도 보유하지 않으면 조리도구가 필요한 레시피는 모두 제외
                query += `
                    AND r.id NOT IN (
                        SELECT DISTINCT recipe_id FROM recipe_tools
                    )
                `;
            }
            
            const [recipeRows] = await pool.execute(query, params);
            
            if (recipeRows.length === 0) {
                return [];
            }
            
            // 각 레시피의 재료 ID 목록 조회
            const recipeIds = recipeRows.map(r => r.recipeId);
            const recipePlaceholders = recipeIds.map(() => '?').join(',');
            
            const [ingRows] = await pool.execute(
                `SELECT recipe_id, ingredient_master_id 
                 FROM recipe_ingredients 
                 WHERE recipe_id IN (${recipePlaceholders})
                 ORDER BY recipe_id, ingredient_master_id`,
                recipeIds
            );
            
            // 레시피별 재료 ID 그룹화
            const ingredientsByRecipe = {};
            ingRows.forEach(ing => {
                if (!ingredientsByRecipe[ing.recipe_id]) {
                    ingredientsByRecipe[ing.recipe_id] = [];
                }
                ingredientsByRecipe[ing.recipe_id].push(ing.ingredient_master_id);
            });
            
            // requireMain 필터링: recipe_main_ingredients 테이블에서 메인 재료를 조회하여 필터링
            let mainIngredientsByRecipe = {};
            if (requireMain && recipeIds.length > 0) {
                const [mainIngRows] = await pool.execute(
                    `SELECT recipe_id, ingredient_master_id 
                     FROM recipe_main_ingredients 
                     WHERE recipe_id IN (${recipePlaceholders})`,
                    recipeIds
                );
                
                // 레시피별 메인 재료 ID 그룹화
                mainIngRows.forEach(row => {
                    if (!mainIngredientsByRecipe[row.recipe_id]) {
                        mainIngredientsByRecipe[row.recipe_id] = [];
                    }
                    mainIngredientsByRecipe[row.recipe_id].push(row.ingredient_master_id);
                });
            }
            
            const candidates = [];
            for (const recipe of recipeRows) {
                const ingredientIds = ingredientsByRecipe[recipe.recipeId] || [];
                
                if (ingredientIds.length === 0) continue;
                
                // requireMain이 true면 recipe_main_ingredients 테이블의 메인 재료가 모두 사용자 보유 식재료에 있어야 함
                if (requireMain) {
                    const mainIngredientIds = mainIngredientsByRecipe[recipe.recipeId] || [];
                    
                    // 메인 재료가 없는 레시피는 제외
                    if (mainIngredientIds.length === 0) {
                        continue;
                    }
                    
                    // 메인 재료 중 하나라도 사용자가 보유하지 않으면 제외
                    const hasAllMainIngredients = mainIngredientIds.every(mainId => 
                        ownedIngredientMasterIds.includes(mainId)
                    );
                    
                    if (!hasAllMainIngredients) {
                        continue; // 메인 재료가 부족하면 제외
                    }
                }
                
                candidates.push({
                    recipeId: recipe.recipeId,
                    ingredientIds: ingredientIds
                });
            }
            
            return candidates;
            
        } catch (error) {
            console.error('RecipeRepository.filterRecipesForRecommendation 오류:', error);
            throw error;
        }
    }

    /**
     * (POST /api/recipes/:id/view 호출 시 사용)
     * 레시피 조회수를 1 증가시킵니다.
     */
    static async incrementViewCount(recipeId) {
        try {
            const query = 'UPDATE recipes SET view_count = view_count + 1 WHERE id = ?';
            await pool.execute(query, [recipeId]);
        } catch (error) {
            console.error('RecipeRepository.incrementViewCount 오류:', error);
            throw error;
        }
    }
    
    // --- 나머지 목록 및 통계 로직은 여기에 정의됨 ---
    static async searchRecipes(keyword) { /* 키워드 검색 로직 */ return []; }
    
    /**
     * GET /api/admin/stats/recipes
     * view_count와 recommendation_count를 합산하여 상위 10개 레시피를 조회합니다.
     * @param {number} limit - 조회할 레시피 개수 (기본값: 10)
     * @returns {Array<Object>} 레시피 통계 배열 [{ recipeId, title, recommendation_count, view_count }]
     */
    static async getRecipePerformanceStats(limit = 10) {
        try {
            const query = `
                SELECT 
                    r.id AS recipeId,
                    r.title,
                    COALESCE(COUNT(rl.id), 0) AS recommendation_count,
                    COALESCE(r.view_count, 0) AS view_count
                FROM recipes r
                LEFT JOIN recommendation_logs rl ON r.id = rl.recipe_id
                GROUP BY r.id, r.title, r.view_count
                ORDER BY (COALESCE(r.view_count, 0) + COALESCE(COUNT(rl.id), 0)) DESC
                LIMIT ?
            `;
            
            const [rows] = await pool.execute(query, [limit]);
            
            return rows.map(row => ({
                recipeId: row.recipeId,
                title: row.title,
                recommendation_count: parseInt(row.recommendation_count, 10),
                view_count: parseInt(row.view_count, 10)
            }));
            
        } catch (error) {
            console.error('RecipeRepository.getRecipePerformanceStats 오류:', error);
            throw error;
        }
    }
    
    /**
     * GET /api/recipes/popular
     * view_count가 가장 높은 상위 N개의 레시피를 조회합니다.
     * @param {number} limit - 조회할 레시피 개수 (기본값: 10)
     * @returns {Array<Object>} 레시피 목록 (id, title, description, required_ingredients, main_image_url)
     */
    static async findTopViewedRecipes(limit = 10) {
        try {
            // 1. view_count 기준으로 상위 N개 레시피 조회
            const [recipeRows] = await pool.execute(
                `SELECT id, title, description, main_image_url 
                 FROM recipes 
                 ORDER BY view_count DESC 
                 LIMIT ?`,
                [limit]
            );
            
            if (recipeRows.length === 0) {
                return [];
            }
            
            // 2. 레시피 ID 목록 추출
            const recipeIds = recipeRows.map(r => r.id);
            const placeholders = recipeIds.map(() => '?').join(',');
            
            // 3. 각 레시피의 재료 목록 조회
            const [ingRows] = await pool.execute(
                `SELECT ri.recipe_id, im.name 
                 FROM recipe_ingredients ri 
                 JOIN ingredients_master im ON ri.ingredient_master_id = im.id
                 WHERE ri.recipe_id IN (${placeholders})
                 ORDER BY ri.recipe_id, ri.ingredient_master_id`,
                recipeIds
            );
            
            // 4. 레시피별 재료 그룹화
            const ingredientsByRecipe = {};
            ingRows.forEach(ing => {
                if (!ingredientsByRecipe[ing.recipe_id]) {
                    ingredientsByRecipe[ing.recipe_id] = [];
                }
                ingredientsByRecipe[ing.recipe_id].push(ing.name);
            });
            
            // 5. 결과 구성
            return recipeRows.map(recipe => ({
                id: recipe.id,
                title: recipe.title,
                description: recipe.description,
                required_ingredients: ingredientsByRecipe[recipe.id] || [],
                main_image_url: recipe.main_image_url
            }));
            
        } catch (error) {
            console.error('RecipeRepository.findTopViewedRecipes 오류:', error);
            throw error;
        }
    }
    /**
     * GET /api/recipes/history
     * 사용자의 최근 본 레시피 목록을 조회합니다.
     * @param {number} userId - 사용자 ID
     * @returns {Array<Object>} 레시피 목록 (id, title, description, required_ingredients, main_image_url)
     */
    static async findHistoryByUserId(userId) {
        try {
            // 1. 최근 조회한 레시피 ID 목록 조회 (중복 제거, 최신순)
            const recentViews = await RecipeViewLogRepository.findDistinctRecentViews(userId, 50);
            
            if (recentViews.length === 0) {
                return [];
            }
            
            // 2. 레시피 ID 목록 추출
            const recipeIds = recentViews.map(view => view.id);
            const placeholders = recipeIds.map(() => '?').join(',');
            
            // 3. 레시피 기본 정보 조회
            const [recipeRows] = await pool.execute(
                `SELECT id, title, description, main_image_url 
                 FROM recipes 
                 WHERE id IN (${placeholders})`,
                recipeIds
            );
            
            if (recipeRows.length === 0) {
                return [];
            }
            
            // 4. 각 레시피의 재료 목록 조회
            const recipePlaceholders = recipeIds.map(() => '?').join(',');
            const [ingRows] = await pool.execute(
                `SELECT ri.recipe_id, im.name 
                 FROM recipe_ingredients ri 
                 JOIN ingredients_master im ON ri.ingredient_master_id = im.id
                 WHERE ri.recipe_id IN (${recipePlaceholders})
                 ORDER BY ri.recipe_id, ri.ingredient_master_id`,
                recipeIds
            );
            
            // 5. 레시피별 재료 그룹화
            const ingredientsByRecipe = {};
            ingRows.forEach(ing => {
                if (!ingredientsByRecipe[ing.recipe_id]) {
                    ingredientsByRecipe[ing.recipe_id] = [];
                }
                ingredientsByRecipe[ing.recipe_id].push(ing.name);
            });
            
            // 6. 조회 순서 유지하면서 결과 구성
            const recipeMap = {};
            recipeRows.forEach(recipe => {
                recipeMap[recipe.id] = recipe;
            });
            
            // 최근 조회 순서대로 정렬
            return recentViews
                .filter(view => recipeMap[view.id])
                .map(view => {
                    const recipe = recipeMap[view.id];
                    return {
                        id: recipe.id,
                        title: recipe.title,
                        description: recipe.description,
                        required_ingredients: ingredientsByRecipe[recipe.id] || [],
                        main_image_url: recipe.main_image_url
                    };
                });
                
        } catch (error) {
            console.error('RecipeRepository.findHistoryByUserId 오류:', error);
            throw error;
        }
    }
    /**
     * DELETE /api/admin/recipes/:id
     * 레시피를 삭제하고 관련 이미지 파일도 삭제합니다.
     * @param {number} recipeId - 레시피 ID
     * @returns {boolean} 삭제 성공 여부
     */
    static async deleteById(recipeId) {
        const fs = require('fs');
        const path = require('path');
        const { getRecipeImageDirectory } = require('../utils/recipeImagePath');
        
        try {
            // 1. 레시피 이미지 디렉토리 경로 가져오기
            const recipeImageDir = getRecipeImageDirectory(recipeId);
            
            // 2. DB에서 레시피 삭제 (CASCADE 설정으로 인해 주 테이블만 삭제하면 연관 테이블은 자동 삭제됨)
            const [result] = await pool.execute('DELETE FROM recipes WHERE id = ?', [recipeId]);
            
            if (result.affectedRows > 0) {
                // 3. 레시피 삭제 성공 시 이미지 파일도 삭제
                if (fs.existsSync(recipeImageDir)) {
                    // 디렉토리 전체 삭제 (재귀적으로)
                    fs.rmSync(recipeImageDir, { recursive: true, force: true });
                    console.log(`레시피 이미지 디렉토리 삭제 완료: ${recipeImageDir}`);
                }
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('RecipeRepository.deleteById 오류:', error);
            // DB 삭제는 성공했지만 파일 삭제 실패한 경우도 true 반환 (DB 삭제는 완료됨)
            // 파일 삭제 실패는 로그만 남기고 계속 진행
            throw error;
        }
    }
    // ...
}

module.exports = {
    RecipeRepository,
    Recipe 
};