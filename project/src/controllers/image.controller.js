// 파일 경로: src/controllers/image.controller.js

const { ImageAnalysisRepository } = require('../models/ImageAnalysis.model');
const aiService = require('../services/ai.service'); // AI 서버 통신 서비스 (별도 정의 필요)
const fs = require('fs'); // 업로드 실패 시 파일 정리용
const logger = require('../utils/logger');

// --- POST /api/images/upload (이미지 업로드 및 분석 요청) ---
/**
 * 사용자가 업로드한 이미지를 DB에 기록하고, AI 서버로 분석을 요청합니다.
 */
const uploadImage = async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        logger.info(`[User:${userId}]`, 'POST /api/images/upload 요청 수신');

        if (!file) {
            logger.warn(`[User:${userId}]`, 'POST /api/images/upload - 파일 없음');
            return res.status(400).json({
                success: false,
                result_code: 400,
                message: '업로드할 이미지 파일이 필요합니다.'
            });
        }
        
        // Multer가 저장한 서버 경로 (예: uploads/analysis_images/image-12345.jpg)
        const imagePath = file.path; 
        const originalFilename = file.originalname;

        // 1. DB에 분석 요청 기록 (초기 상태: PENDING)
        const newAnalysis = await ImageAnalysisRepository.create({
            userId,
            image_url: imagePath, // DB에는 경로 저장
            original_filename: originalFilename,
            status: 'PENDING', 
        });

        logger.info(`[User:${userId}]`, `이미지 분석 요청 완료 (analysis_id: ${newAnalysis.id})`);

        // 2. AI 서버에 분석 작업 요청 (비동기 처리)
        // 분석 시작 시 상태를 PROCESSING으로 업데이트
        ImageAnalysisRepository.updateStatus(newAnalysis.id, 'PROCESSING')
            .catch(statusError => {
                logger.error(`[User:${userId}]`, `상태 업데이트 실패 (analysis_id: ${newAnalysis.id}): ${statusError.message}`);
                // 상태 업데이트 실패해도 분석은 계속 진행
            })
            .then(() => {
                logger.info(`[User:${userId}]`, `이미지 분석 시작 (analysis_id: ${newAnalysis.id})`);
                return aiService.requestImageAnalysis(userId, imagePath);
            })
            .then((aiResponse) => {
                // AI 서버 응답: { success, message, result_code, detections }
                if (aiResponse.success && aiResponse.detections) {
                    // 분석 성공: detections를 identified_ingredients로 변환하여 DB에 저장
                    // detections 형식: [{ classId, label, bbox, confidence }]
                    ImageAnalysisRepository.updateAsCompleted(newAnalysis.id, aiResponse.detections);
                    logger.info(`[User:${userId}]`, `이미지 분석 완료 (analysis_id: ${newAnalysis.id})`);
                } else {
                    // 분석 실패
                    ImageAnalysisRepository.updateAsFailed(
                        newAnalysis.id, 
                        aiResponse.message || '이미지 분석에 실패했습니다.'
                    );
                    logger.warn(`[User:${userId}]`, `이미지 분석 실패 (analysis_id: ${newAnalysis.id}): ${aiResponse.message || '이미지 분석에 실패했습니다.'}`);
                }
            })
            .catch(error => {
                logger.error(`[User:${userId}]`, `AI 분석 요청 실패 (analysis_id: ${newAnalysis.id}): ${error.message}`);
                // 요청 실패 시 DB 상태를 FAILED로 업데이트
                const errorMessage = error.message || 'AI 서버 통신 중 오류가 발생했습니다.';
                ImageAnalysisRepository.updateAsFailed(newAnalysis.id, errorMessage)
                    .catch(updateError => {
                        logger.error(`[User:${userId}]`, `상태 업데이트 실패 (analysis_id: ${newAnalysis.id}): ${updateError.message}`);
                    });
                // NOTE: 실패했으므로 해당 파일 삭제 로직 추가 가능
                fs.unlink(imagePath, (err) => { 
                    if (err) logger.error(`[User:${userId}]`, `분석 요청 실패 후 파일 삭제 오류: ${err.message}`);
                });
            });
        
        res.status(201).json({
            success: true,
            result_code: 201, // 201 Created: DB 레코드 생성 완료
            message: '이미지가 성공적으로 업로드되었으며, 분석 대기 중입니다.',
            data: {
                id: newAnalysis.id,
                user_id: newAnalysis.user_id,
                status: 'PENDING',
                image_url: newAnalysis.image_url,
                uploaded_at: newAnalysis.uploaded_at
            }
        });

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `이미지 업로드 처리 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '이미지 업로드 및 요청 처리 중 오류가 발생했습니다.'
        });
    }
};

// --- GET /api/images/analysis/:id (분석 결과 조회 - Polling) ---
/**
 * 특정 이미지 분석 작업의 진행 상태와 최종 결과를 조회합니다.
 */
const getImageAnalysisResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const analysisId = parseInt(req.params.id, 10);

        // 1. DB에서 분석 기록 조회
        const analysis = await ImageAnalysisRepository.findById(analysisId);

        if (!analysis) {
            return res.status(404).json({
                success: false,
                result_code: 404,
                message: '해당 분석 ID를 찾을 수 없습니다.'
            });
        }

        // 2. 권한 검증 (본인의 분석 요청인지 확인)
        if (analysis.user_id !== userId) {
            return res.status(403).json({
                success: false,
                result_code: 403,
                message: '해당 분석 결과에 접근할 권한이 없습니다.'
            });
        }
        
        // 3. 상태에 따른 응답 반환
        if (analysis.status === 'COMPLETED') {
            res.status(200).json({
                success: true,
                result_code: 200,
                message: '분석이 완료되었습니다.',
                data: {
                    id: analysis.id,
                    status: analysis.status,
                    // JSON 필드를 파싱하여 반환
                    identified_ingredients: analysis.identified_ingredients ? JSON.parse(analysis.identified_ingredients) : null, 
                    image_url: analysis.image_url,
                    analyzed_at: analysis.analyzed_at
                }
            });
        } else if (analysis.status === 'FAILED') {
             res.status(200).json({ // HTTP 상태는 200 (조회 성공), result_code는 603 (이미지 분석 실패)
                success: false, 
                result_code: 603, // 603: 이미지 분석 실패
                message: '이미지 분석에 실패했습니다. 다시 시도해주세요.',
                data: {
                    id: analysis.id,
                    status: analysis.status,
                    error_message: analysis.error_message,
                    analyzed_at: analysis.analyzed_at
                }
            });
        } else { // PENDING 또는 PROCESSING
            res.status(202).json({ // 202 Accepted: 처리 중임을 알림
                success: true,
                result_code: 202,
                message: '이미지 분석이 진행 중입니다.',
                data: {
                    id: analysis.id,
                    status: analysis.status
                }
            });
        }

    } catch (error) {
        logger.error(`[User:${req.user?.id || 'unknown'}]`, `분석 결과 조회 중 오류: ${error.message}`);
        res.status(500).json({
            success: false,
            result_code: 500,
            message: '분석 결과 조회 중 오류가 발생했습니다.'
        });
    }
};

module.exports = {
    uploadImage,
    getImageAnalysisResult
};