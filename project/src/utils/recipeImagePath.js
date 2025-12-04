// 파일 경로: src/utils/recipeImagePath.js

const path = require('path');
const fs = require('fs');

/**
 * 레시피 이미지 경로를 생성하는 유틸리티 함수
 * 해시 기반 분산 구조: uploads/recipes/{bucket}/{subFolder}/main.jpg 또는 steps/{stepNumber}.jpg
 * 
 * @param {number} recipeId - 레시피 ID
 * @param {string} type - 이미지 타입 ('main' 또는 'step')
 * @param {number} stepNumber - step 이미지인 경우 단계 번호 (선택)
 * @returns {string} 상대 경로 (예: 'uploads/recipes/1/520/main.jpg')
 */
function getRecipeImagePath(recipeId, type, stepNumber = null) {
    // 해시 기반 분산: recipeId를 1000으로 나눈 몫과 나머지 사용
    const bucket = Math.floor(recipeId / 1000);  // 0-999 범위로 분산
    const subFolder = recipeId % 1000;          // 실제 레시피 ID의 나머지
    
    if (type === 'main') {
        return path.join('uploads', 'recipes', String(bucket), String(subFolder), 'main.jpg');
    } else if (type === 'step') {
        if (stepNumber === null || stepNumber === undefined) {
            throw new Error('stepNumber is required for step images');
        }
        return path.join('uploads', 'recipes', String(bucket), String(subFolder), 'steps', `${stepNumber}.jpg`);
    } else {
        throw new Error(`Invalid image type: ${type}. Must be 'main' or 'step'`);
    }
}

/**
 * 레시피 이미지 URL을 생성하는 함수 (웹에서 접근 가능한 경로)
 * 
 * @param {number} recipeId - 레시피 ID
 * @param {string} type - 이미지 타입 ('main' 또는 'step')
 * @param {number} stepNumber - step 이미지인 경우 단계 번호 (선택)
 * @returns {string} URL 경로 (예: '/uploads/recipes/1/520/main.jpg')
 */
function getRecipeImageUrl(recipeId, type, stepNumber = null) {
    const filePath = getRecipeImagePath(recipeId, type, stepNumber);
    // Windows 경로 구분자를 URL 경로 구분자로 변환
    return '/' + filePath.replace(/\\/g, '/');
}

/**
 * 레시피 이미지 디렉토리를 생성하는 함수
 * 
 * @param {number} recipeId - 레시피 ID
 * @returns {string} 디렉토리 경로
 */
function ensureRecipeImageDirectory(recipeId) {
    const bucket = Math.floor(recipeId / 1000);
    const subFolder = recipeId % 1000;
    
    const baseDir = path.join(__dirname, '..', '..', 'uploads', 'recipes');
    const bucketDir = path.join(baseDir, String(bucket));
    const recipeDir = path.join(bucketDir, String(subFolder));
    const stepsDir = path.join(recipeDir, 'steps');
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(bucketDir)) {
        fs.mkdirSync(bucketDir, { recursive: true });
    }
    if (!fs.existsSync(recipeDir)) {
        fs.mkdirSync(recipeDir, { recursive: true });
    }
    if (!fs.existsSync(stepsDir)) {
        fs.mkdirSync(stepsDir, { recursive: true });
    }
    
    return recipeDir;
}

/**
 * 레시피 이미지 디렉토리 경로를 반환하는 함수
 * 
 * @param {number} recipeId - 레시피 ID
 * @returns {string} 디렉토리 절대 경로
 */
function getRecipeImageDirectory(recipeId) {
    const bucket = Math.floor(recipeId / 1000);
    const subFolder = recipeId % 1000;
    
    return path.join(__dirname, '..', '..', 'uploads', 'recipes', String(bucket), String(subFolder));
}

module.exports = {
    getRecipeImagePath,
    getRecipeImageUrl,
    ensureRecipeImageDirectory,
    getRecipeImageDirectory
};

