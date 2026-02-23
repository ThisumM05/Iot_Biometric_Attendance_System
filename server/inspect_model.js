import onnx from 'onnxruntime-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, 'ml_models/yolov8n-face-lindevs.onnx');

async function inspectModel() {
    try {
        console.log(`Loading model from: ${MODEL_PATH}`);
        const session = await onnx.InferenceSession.create(MODEL_PATH);

        console.log('\n--- Model Info ---');
        console.log('Input Names:', session.inputNames);
        console.log('Output Names:', session.outputNames);

        const inputName = session.inputNames[0];
        console.log(`Input: ${inputName}`);

        // Run dummy inference to get output shape
        const inputShape = [1, 3, 640, 640];
        const dummyData = new Float32Array(1 * 3 * 640 * 640).fill(0);
        const tensor = new onnx.Tensor('float32', dummyData, inputShape);
        const feeds = { [inputName]: tensor };
        const results = await session.run(feeds);

        const outputName = session.outputNames[0];
        const output = results[outputName];
        console.log('\n--- Output Details ---');
        console.log(`Output Name: ${outputName}`);
        console.log(`Output Shape: ${output.dims}`);
        console.log(`Output Data Length: ${output.data.length}`);

        console.log('\n--- Success: Model inspected ---');
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectModel();
