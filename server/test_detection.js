import yoloFaceService from './services/ml/yoloFaceService.js';
import sharp from 'sharp';
import fs from 'fs';

async function runTest() {
    console.log('--- YOLOv8-Face Detection Test ---');

    // Create a dummy image (black background with some noise)
    // or if we had a real image, we'd use it.
    // For now, let's just make sure it runs without crashing.
    try {
        const dummyBuffer = await sharp({
            create: {
                width: 640,
                height: 480,
                channels: 3,
                background: { r: 0, g: 0, b: 0 }
            }
        }).jpeg().toBuffer();

        console.log('Generated dummy JPEG buffer.');

        console.log('Running detection...');
        const count = await yoloFaceService.detect(dummyBuffer);

        console.log(`Test Result: Detected ${count} faces on a black image.`);
        console.log('✅ Detection logic is operational.');
    } catch (error) {
        console.error('❌ Detection test failed:', error);
    }
}

runTest();
