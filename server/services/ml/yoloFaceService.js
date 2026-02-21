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
        this.confThreshold = 0.5;
        this.iouThreshold = 0.4;
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

        // 1. Preprocess Image
        const { tensor, scale, padding } = await this.preprocess(imageBuffer);

        // 2. Run Inference
        const feeds = { images: tensor };
        const results = await this.session.run(feeds);
        const output = results[this.session.outputNames[0]].data;

        // 3. Postprocess (Parse Output & NMS)
        const detections = this.postprocess(output, scale, padding);

        return detections.length;
    }

    async preprocess(imageBuffer) {
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        // Resize and pad to 640x640 (letterbox)
        const size = 640;
        const scale = Math.min(size / originalWidth, size / originalHeight);
        const newWidth = Math.round(originalWidth * scale);
        const newHeight = Math.round(originalHeight * scale);

        const padding = {
            top: Math.floor((size - newHeight) / 2),
            left: Math.floor((size - newWidth) / 2)
        };

        const resizedBuffer = await sharp(imageBuffer)
            .resize(newWidth, newHeight)
            .extend({
                top: padding.top,
                bottom: size - newHeight - padding.top,
                left: padding.left,
                right: size - newWidth - padding.left,
                background: { r: 114, g: 114, b: 114 } // YOLO padding color
            })
            .toColorspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const data = resizedBuffer.data;
        const channels = resizedBuffer.info.channels; // Should be 3

        // Convert to Float32 Tensor [1, 3, 640, 640], Normalized 0-1
        const float32Data = new Float32Array(3 * size * size);
        for (let i = 0; i < size * size; i++) {
            float32Data[i] = data[i * channels] / 255.0;       // R
            float32Data[size * size + i] = data[i * channels + 1] / 255.0; // G
            float32Data[2 * size * size + i] = data[i * channels + 2] / 255.0; // B
        }

        const tensor = new onnx.Tensor('float32', float32Data, [1, 3, size, size]);
        return { tensor, scale, padding };
    }

    postprocess(outputData, scale, padding) {
        const boxes = [];
        const scores = [];
        const numClasses = 1; // Face only
        const numElements = 8400; // 640x640 output grid
        const outputChannels = 4 + numClasses; // cx, cy, w, h, score

        // Output shape is usually [1, 5, 8400] for YOLOv8 (transposed) or [1, 8400, 5]
        // We handle transposed manually by iterating correctly.
        // Assuming [1, 5, 8400]: index = channel * 8400 + anchor_index

        for (let i = 0; i < numElements; i++) {
            // Get score (index 4 for class 0)
            const score = outputData[4 * numElements + i];

            if (score > this.confThreshold) {
                const cx = outputData[0 * numElements + i];
                const cy = outputData[1 * numElements + i];
                const w = outputData[2 * numElements + i];
                const h = outputData[3 * numElements + i];

                // Convert to corners
                const x1 = (cx - w / 2 - padding.left) / scale;
                const y1 = (cy - h / 2 - padding.top) / scale;
                const x2 = (cx + w / 2 - padding.left) / scale;
                const y2 = (cy + h / 2 - padding.top) / scale;

                boxes.push([x1, y1, x2, y2]);
                scores.push(score);
            }
        }

        return this.nonMaxSuppression(boxes, scores);
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
