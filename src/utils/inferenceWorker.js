import * as ort from "onnxruntime-web";

const MODEL_URL =
  "https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx";
const MODEL_SIZE_BYTES = 17_500_000;

let session = null;

async function fetchModelWithProgress() {
  const response = await fetch(MODEL_URL);
  const contentLength = parseInt(response.headers.get("content-length")) || MODEL_SIZE_BYTES;
  const reader = response.body.getReader();
  let received = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    self.postMessage({
      type: "download",
      pct: Math.min(99, Math.round((received / contentLength) * 100)),
    });
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return buffer.buffer;
}

async function loadSession() {
  if (session) return session;
  const providers = navigator.gpu ? ["webgpu", "wasm"] : ["wasm"];
  ort.env.wasm.proxy = false;
  const buffer = await fetchModelWithProgress();
  self.postMessage({ type: "download", pct: 100 });
  session = await ort.InferenceSession.create(buffer, { executionProviders: providers });
  return session;
}

async function runInference({ imageData, width, height, sensitivity, isMobile }) {
  const sess = await loadSession();

  const TILE = isMobile ? 512 : 768;
  const OVERLAP = 64;
  const STEP = TILE - OVERLAP * 2;

  const ramp = new Float32Array(TILE);
  for (let i = 0; i < TILE; i++) {
    ramp[i] = Math.min(1, i / OVERLAP, (TILE - 1 - i) / OVERLAP);
  }

  const xs = getTileStarts(width, TILE, STEP);
  const ys = getTileStarts(height, TILE, STEP);
  const totalTiles = xs.length * ys.length;
  let doneTiles = 0;

  const output = new Float32Array(width * height);
  const weight = new Float32Array(width * height);
  const d = imageData;

  for (const ty of ys) {
    for (const tx of xs) {
      const tw = Math.min(TILE, width - tx);
      const th = Math.min(TILE, height - ty);

      const tensor = new Float32Array(3 * TILE * TILE);
      for (let row = 0; row < TILE; row++) {
        for (let col = 0; col < TILE; col++) {
          const srcRow = Math.min(row, th - 1);
          const srcCol = Math.min(col, tw - 1);
          const si = ((ty + srcRow) * width + (tx + srcCol)) * 4;
          const di = row * TILE + col;
          tensor[di] = d[si] / 255;
          tensor[TILE * TILE + di] = d[si + 1] / 255;
          tensor[2 * TILE * TILE + di] = d[si + 2] / 255;
        }
      }

      const input = new ort.Tensor("float32", tensor, [1, 3, TILE, TILE]);
      const results = await sess.run({ input });
      const tileOut = results["output"].data;

      doneTiles++;
      self.postMessage({ type: "tile", pct: Math.round((doneTiles / totalTiles) * 100) });

      for (let row = 0; row < th; row++) {
        for (let col = 0; col < tw; col++) {
          const w = ramp[row] * ramp[col];
          const oi = (ty + row) * width + (tx + col);
          output[oi] += tileOut[row * TILE + col] * w;
          weight[oi] += w;
        }
      }
    }
  }

  for (let i = 0; i < output.length; i++) {
    if (weight[i] > 0) output[i] /= weight[i];
  }

  // Apply contrast stretch + sensitivity
  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < output.length; i++) {
    if (output[i] < minVal) minVal = output[i];
    if (output[i] > maxVal) maxVal = output[i];
  }
  const range = maxVal - minVal || 1;
  const blackPoint = 0.3 + sensitivity * 0.55;

  const outPixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const norm = (output[i] - minVal) / range;
    const val = Math.min(255, Math.max(0, ((norm - (1 - blackPoint)) / blackPoint) * 255));
    outPixels[i * 4] = val;
    outPixels[i * 4 + 1] = val;
    outPixels[i * 4 + 2] = val;
    outPixels[i * 4 + 3] = 255;
  }

  return outPixels;
}

function getTileStarts(size, tileSize, step) {
  const starts = [];
  for (let s = 0; s < size; s += step) {
    starts.push(Math.min(s, Math.max(0, size - tileSize)));
    if (s + tileSize >= size) break;
  }
  return [...new Set(starts)];
}

self.onmessage = async (e) => {
  try {
    const outPixels = await runInference(e.data);
    self.postMessage({ type: "done", outPixels, width: e.data.width, height: e.data.height }, [outPixels.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
