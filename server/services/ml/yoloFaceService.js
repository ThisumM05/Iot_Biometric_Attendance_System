import onnx from 'onnxruntime-node';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, '../../ml_models/yolov8n-face-lindevs.onnx');

class YoloFaceService {
    constructor() {
        this.session = null;
        this.inputShape = [1, 3, 640, 640]; // YOLOv8 standard input
        this.confThreshold = 0.05; // More sensitive
        this.iouThreshold = 0.4;
        this.frameCount = 0;
        this.debug = false; // Reduce noise now that it works
    }

    async loadModel() {
        if (this.session) return;
        try {
            console.log('⏳ Loading YOLOv8-Face model via ONNX Runtime...');
            this.session = await onnx.InferenceSession.create(MODEL_PATH);
            console.log('✓ YOLOv8-Face model loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load YOLOv8 ONNX model:', error.message);
            throw error;
        }
    }

    /**
     * Detect faces in an image buffer
     * @param {Buffer} imageBuffer - JPEG/PNG buffer
     * @returns {Promise<number>} - Number of faces detected
     */
    async detect(imageBuffer) {
        if (!this.session) await this.loadModel();

        this.frameCount++;

        // 1. Preprocess Image
        const { tensor, scale, padding, float32Data } = await this.preprocess(imageBuffer);

        // 2. Run Inference
        const feeds = { images: tensor };
        const results = await this.session.run(feeds);
        const outputTensor = results[this.session.outputNames[0]];
        const output = outputTensor.data;

        // 3. Postprocess (Parse Output & NMS)
        const { detections, channelMaxes, maxScore } = this.postprocess(output, scale, padding);

        if (this.frameCount % 100 === 0) {
            let sum = 0;
            for (let i = 0; i < float32Data.length; i++) sum += float32Data[i];
            const avgIntensity = sum / float32Data.length;
            console.log(`📊 [YOLO] Health Check | Intensity: ${avgIntensity.toFixed(2)} | MaxScore: ${(maxScore * 100).toFixed(1)}%`);
        }

        if (detections.length > 0) {
            console.log(`✅ [YOLO] Detections: ${detections.length} faces`);
        }

        return detections.length;
    }

    async preprocess(imageBuffer) {
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;
        const size = 640;

        const resizedBuffer = await sharp(imageBuffer)
            .resize(size, size) // STRETCH (Better for this model)
            .modulate({
                brightness: 1.1,
                contrast: 1.5 // Significant boost
            })
            .toColorspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const data = resizedBuffer.data;
        const channels = resizedBuffer.info.channels; // Should be 3

        const scale = { x: size / originalWidth, y: size / originalHeight };
        const padding = { top: 0, left: 0 };

        // Convert to Float32 Tensor [1, 3, 640, 640], Normalized 0-1
        const float32Data = new Float32Array(3 * size * size);
        for (let i = 0; i < size * size; i++) {
            float32Data[i] = data[i * channels + 2] / 255.0;       // B
            float32Data[size * size + i] = data[i * channels + 1] / 255.0; // G
            float32Data[2 * size * size + i] = data[i * channels] / 255.0; // R
        }

        const tensor = new onnx.Tensor('float32', float32Data, [1, 3, size, size]);
        return { tensor, scale, padding, float32Data };
    }

    postprocess(outputData, scale, padding) {
        const boxes = [];
        const scores = [];
        const numElements = 8400; // 640x640 output grid

        // Output shape is usually [1, 5, 8400] for YOLOv8 (transposed) or [1, 8400, 5]
        // We handle transposed manually by iterating correctly.
        // Assuming [1, 5, 8400]: index = channel * 8400 + anchor_index

        let maxScore = 0;
        let channelMaxes = [0, 0, 0, 0, 0];

        for (let i = 0; i < numElements; i++) {
            // Track max value per channel for diagnostics
            for (let c = 0; c < 5; c++) {
                const val = outputData[c * numElements + i];
                if (val > channelMaxes[c]) channelMaxes[c] = val;
            }

            const score = outputData[4 * numElements + i];
            if (score > maxScore) maxScore = score;

            if (score > this.confThreshold) {
                const cx = outputData[0 * numElements + i];
                const cy = outputData[1 * numElements + i];
                const w = outputData[2 * numElements + i];
                const h = outputData[3 * numElements + i];

                // Convert to corners using stretch scale
                const x1 = (cx - w / 2) / scale.x;
                const y1 = (cy - h / 2) / scale.y;
                const x2 = (cx + w / 2) / scale.x;
                const y2 = (cy + h / 2) / scale.y;

                boxes.push([x1, y1, x2, y2]);
                scores.push(score);

                if (boxes.length === 1 && this.frameCount % 10 === 0) {
                    console.log(`📦 [YOLO] Detection! Score: ${(score * 100).toFixed(1)}%, Dim: ${w.toFixed(1)}x${h.toFixed(1)}`);
                }
            }
        }

        const detections = this.nonMaxSuppression(boxes, scores);
        return { detections, channelMaxes, maxScore };
    }

    nonMaxSuppression(boxes, scores) {
        const indices = new Array(scores.length).fill(0).map((_, i) => i);

        // Sort by score descending
        indices.sort((a, b) => scores[b] - scores[a]);

        const keep = [];

        while (indices.length > 0) {
            const current = indices.shift();
            keep.push({ box: boxes[current], score: scores[current] });

            for (let i = indices.length - 1; i >= 0; i--) {
                const other = indices[i];
                const iou = this.calculateIoU(boxes[current], boxes[other]);
                if (iou > this.iouThreshold) {
                    indices.splice(i, 1);
                }
            }
        }
        return keep;
    }

    calculateIoU(boxA, boxB) {
        const xA = Math.max(boxA[0], boxB[0]);
        const yA = Math.max(boxA[1], boxB[1]);
        const xB = Math.min(boxA[2], boxB[2]);
        const yB = Math.min(boxA[3], boxB[3]);

        const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
        const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
        const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

        return interArea / (boxAArea + boxBArea - interArea);
    }
}

export default new YoloFaceService();
