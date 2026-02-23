import yoloFaceService from './services/ml/yoloFaceService.js';
import fs from 'fs';
import sharp from 'sharp';

async function testImage() {
    await yoloFaceService.loadModel();
    const imagePath = 'c:/Users/sadee/OneDrive/Documents/Iot_Biometric_Attendance_System/server/debug_frame copy.jpg';
    const buffer = fs.readFileSync(imagePath);
    console.log('--- Sigmoid Activation Verification ---');

    yoloFaceService.preprocess = async function (buf) {
        const size = 640;
        // Use Stretching (Best known) + Contrast Boost
        const res = await sharp(buf).resize(640, 640).modulate({ brightness: 1.0, contrast: 1.5 }).raw().toBuffer({ resolveWithObject: true });
        const data = res.data;
        const floatData = new Float32Array(3 * size * size);
        for (let i = 0; i < size * size; i++) {
            floatData[i] = data[i * 3 + 2] / 255.0;
            floatData[size * size + i] = data[i * 3 + 1] / 255.0;
            floatData[2 * size * size + i] = data[i * 3] / 255.0;
        }
        const onnx = (await import('onnxruntime-node')).default;
        return { tensor: new onnx.Tensor('float32', floatData, [1, 3, size, size]), scale: 1, padding: { top: 0, left: 0 }, float32Data: floatData };
    };

    const sigmoid = (x) => 1 / (1 + Math.exp(-x));

    const feeds = { images: (await yoloFaceService.preprocess(buffer)).tensor };
    const results = await yoloFaceService.session.run(feeds);
    const output = results.output0.data;
    const numElements = 8400;

    let scores = [];
    for (let i = 0; i < numElements; i++) {
        const raw = output[4 * numElements + i];
        scores.push({ raw, prob: sigmoid(raw) });
    }
    scores.sort((a, b) => b.prob - a.prob);

    console.log(`Top 5 Raw: [${scores.slice(0, 5).map(s => s.raw.toFixed(3)).join(', ')}]`);
    console.log(`Top 5 Prob (Sigmoid): [${scores.slice(0, 5).map(s => (s.prob * 100).toFixed(1) + '%').join(', ')}]`);
}
testImage();
