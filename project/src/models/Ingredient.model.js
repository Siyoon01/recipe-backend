// 파일 경로: src/models/Ingredient.model.js

const { pool } = require('../../server');

// --- 1. 식재료 데이터 클래스 (반환 객체 구조) ---
class Ingredient {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.name = data.name;
        this.expiryDate = data.expiryDate;
        this.quantity_value = data.quantity_value;
        this.quantity_unit = data.quantity_unit;
        this.createdAt = data.createAt; // DB 컬럼명에 맞춤
    }

    // API 응답 시 사용
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            name: this.name,
            expiryDate: this.expiryDate,
            quantity_value: parseFloat(this.quantity_value), // API 명세에 따라 숫자로 변환
            quantity_unit: this.quantity_unit,
            createdAt: this.createdAt
        };
    }
}

// --- 2. 식재료 저장소 (Repository) ---
class IngredientRepository {

    /**
     * 식재료 1건을 생성합니다. (POST /api/ingredients)
     */
    static async create(userId, data) {
        try {
            const { name, expiryDate, quantity_value, quantity_unit } = data;
            const insertQuery = `
                INSERT INTO ingredients (user_id, name, expiryDate, quantity_value, quantity_unit) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result] = await pool.execute(insertQuery, [userId, name, expiryDate, quantity_value, quantity_unit]);
            
            return this.findById(result.insertId);
        } catch (error) {
            console.error('IngredientRepository.create 오류:', error);
            const err = new Error("식재료 등록 중 DB 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }

    /**
     * 여러 식재료를 일괄 등록합니다. (POST /api/ingredients/bulk)
     */
    static async createBulk(userId, ingredients) {
        // 일괄 삽입을 위한 [ [val1, val2, ...], [val1, val2, ...] ] 형태의 배열 생성
        const values = ingredients.map(ing => [
            userId, 
            ing.name, 
            ing.expiryDate, 
            ing.quantity_value, 
            ing.quantity_unit
        ]);

        try {
            const insertQuery = `
                INSERT INTO ingredients (user_id, name, expiryDate, quantity_value, quantity_unit) 
                VALUES ?
            `;
            const [result] = await pool.query(insertQuery, [values]);
            
            return result.affectedRows; // 삽입된 행의 수 반환
        } catch (error) {
            console.error('IngredientRepository.createBulk 오류:', error);
            const err = new Error("식재료 일괄 등록 처리 중 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }

    /**
     * ID로 식재료 1건을 조회합니다.
     */
    static async findById(id) {
        try {
            const query = 'SELECT * FROM ingredients WHERE id = ?';
            const [rows] = await pool.execute(query, [id]);
            
            return rows.length === 0 ? null : new Ingredient(rows[0]);
        } catch (error) {
            throw error;
        }
    }

    /**
     * 사용자별 식재료 목록을 조회합니다. (GET /api/ingredients)
     */
    static async findByUserId(userId) {
        try {
            const query = 'SELECT * FROM ingredients WHERE user_id = ? ORDER BY expiryDate ASC';
            const [rows] = await pool.execute(query, [userId]);
            
            return rows.map(row => new Ingredient(row).toJSON());
        } catch (error) {
            console.error('IngredientRepository.findByUserId 오류:', error);
            const err = new Error("식재료 목록 조회 중 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }

    /**
     * 식재료 정보를 수정합니다. (PUT /api/ingredients/:id, 소유권 확인 포함)
     */
    static async update(userId, ingredientId, updateData) {
        try {
            const { name, expiryDate, quantity_value, quantity_unit } = updateData;
            
            const updateQuery = `
                UPDATE ingredients 
                SET name = ?, expiryDate = ?, quantity_value = ?, quantity_unit = ?
                WHERE id = ? AND user_id = ?
            `;
            
            const [result] = await pool.execute(updateQuery, [
                name, expiryDate, quantity_value, quantity_unit, ingredientId, userId
            ]);

            // 소유권 없음 또는 ID 없음 오류 처리
            if (result.affectedRows === 0) {
                 return null; // Controller에서 404/403 처리 위임
            }
            
            return this.findById(ingredientId);
        } catch (error) {
            console.error('IngredientRepository.update 오류:', error);
            const err = new Error("식재료 수정 처리 중 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }

    /**
     * 식재료를 삭제합니다. (DELETE /api/ingredients/:id, 소유권 확인 포함)
     */
    static async delete(userId, ingredientId) {
        try {
            const deleteQuery = 'DELETE FROM ingredients WHERE id = ? AND user_id = ?';
            const [result] = await pool.execute(deleteQuery, [ingredientId, userId]);
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('IngredientRepository.delete 오류:', error);
            const err = new Error("식재료 삭제 처리 중 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }

    /**
     * 요리에 사용된 식재료들을 보유 목록에서 차감합니다. (POST /api/ingredients/consume, 트랜잭션 사용)
     */
    static async consumeBulk(userId, consumptionList) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            for (const item of consumptionList) {
                const { id, quantity_value: req_value, quantity_unit: req_unit } = item;

                // 1. 현재 재고 조회 및 소유권 확인
                const [currentRows] = await connection.execute(
                    'SELECT quantity_value, quantity_unit FROM ingredients WHERE id = ? AND user_id = ? FOR UPDATE',
                    [id, userId] // FOR UPDATE로 락(lock) 걸기
                );

                if (currentRows.length === 0) {
                    const err = new Error(`식재료 ID ${id}를 찾을 수 없습니다.`);
                    err.code = 404; throw err; 
                }
                
                const current = currentRows[0];
                const current_value = parseFloat(current.quantity_value); // DECIMAL 타입이 문자열로 올 수 있으므로 파싱
                
                // 2. 단위 및 재고 확인
                if (current.quantity_unit !== req_unit) {
                    const err = new Error(`식재료 ID ${id}의 단위(${current.quantity_unit})와 요청 단위(${req_unit})가 다릅니다.`);
                    err.code = 400; throw err;
                }

                if (current_value < req_value) {
                    const err = new Error(`식재료 ID ${id} (${current_value} ${req_unit} 보유)의 수량이 부족합니다.`);
                    err.code = 602; throw err; // 602: 재고 부족
                }
                
                // 3. 재고 차감 및 업데이트/삭제
                const newQuantity = current_value - req_value;
                
                if (newQuantity <= 0) {
                    await connection.execute('DELETE FROM ingredients WHERE id = ?', [id]);
                } else {
                    await connection.execute('UPDATE ingredients SET quantity_value = ? WHERE id = ?', [newQuantity, id]);
                }
            }

            await connection.commit();
            return true;
            
        } catch (error) {
            await connection.rollback();
            console.error('IngredientRepository.consumeBulk 트랜잭션 오류:', error);
            // 400/404 오류는 Controller로 전달
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * AI 추천 시스템에 필요한 사용자의 보유 식재료 ID 목록을 조회합니다.
     * @deprecated 이 메서드는 사용자 식재료 테이블의 ID를 반환합니다. 마스터 ID가 필요하면 getOwnedIngredientMasterIds를 사용하세요.
     */
    static async getOwnedIngredientIds(userId) {
        try {
            const query = `
                SELECT id FROM ingredients 
                WHERE user_id = ?
            `;
            const [rows] = await pool.execute(query, [userId]);
            
            // 보유 ID 배열 (숫자) 반환
            return rows.map(row => row.id);
        } catch (error) {
            console.error('IngredientRepository.getOwnedIngredientIds 오류:', error);
            throw error;
        }
    }

    /**
     * AI 추천 시스템에 필요한 사용자의 보유 식재료 마스터 ID 목록을 조회합니다.
     * 사용자가 보유한 식재료 이름을 ingredients_master 테이블의 ID로 변환합니다.
     * @param {number} userId - 사용자 ID
     * @returns {Array<number>} 보유 식재료 마스터 ID 배열
     */
    static async getOwnedIngredientMasterIds(userId) {
        try {
            // 1. 사용자가 보유한 식재료 이름 목록 조회
            const [ingredientRows] = await pool.execute(
                'SELECT DISTINCT name FROM ingredients WHERE user_id = ?',
                [userId]
            );
            
            if (ingredientRows.length === 0) return [];
            
            const ingredientNames = ingredientRows.map(row => row.name);
            
            // 2. ingredients_master 테이블에서 해당 이름들의 ID 조회
            const placeholders = ingredientNames.map(() => '?').join(',');
            const [masterRows] = await pool.execute(
                `SELECT id FROM ingredients_master WHERE name IN (${placeholders})`,
                ingredientNames
            );
            
            return masterRows.map(row => row.id);
        } catch (error) {
            console.error('IngredientRepository.getOwnedIngredientMasterIds 오류:', error);
            throw error;
        }
    }

    /**
     * 소비기한이 임박한 식재료 목록을 조회합니다. (조회 시점으로부터 3일 이내)
     * GET /api/ingredients/expiring
     */
    static async findExpiringIngredients(userId) {
        try {
            // 오늘 날짜와 3일 후 날짜 계산
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 오늘 00:00:00
            
            const threeDaysLater = new Date(today);
            threeDaysLater.setDate(today.getDate() + 3); // 3일 후 23:59:59
            threeDaysLater.setHours(23, 59, 59, 999);
            
            // 날짜를 YYYY-MM-DD 형식으로 변환
            const todayStr = today.toISOString().split('T')[0];
            const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];
            
            const query = `
                SELECT * FROM ingredients 
                WHERE user_id = ? 
                AND expiryDate >= ? 
                AND expiryDate <= ?
                ORDER BY expiryDate ASC
            `;
            const [rows] = await pool.execute(query, [userId, todayStr, threeDaysLaterStr]);
            
            return rows.map(row => new Ingredient(row).toJSON());
        } catch (error) {
            console.error('IngredientRepository.findExpiringIngredients 오류:', error);
            const err = new Error("소비기한 임박 식재료 조회 중 오류가 발생했습니다.");
            err.code = 500;
            throw err;
        }
    }
}

module.exports = {
    IngredientRepository,
    Ingredient 
};