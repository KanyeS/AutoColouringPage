import * as ort from "onnxruntime-web";

const MODEL_URL =
  "https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx";
const MODEL_SIZE_BYTES = 17_500_000; // approximate, for progress estimation

let sessionPromise = null;
let modelReady = false;

async function fetchModelWithProgress(onProgress) {
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
    onProgress(Math.min(99, Math.round((received / contentLength) * 100)));
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return buffer.buffer;
}

function getSession(onProgress) {
  if (!sessionPromise) {
    ort.env.wasm.proxy = false;
    if (onProgress) {
      sessionPromise = fetchModelWithProgress(onProgress).then((buffer) => {
        onProgress(100);
        modelReady = true;
        return ort.InferenceSession.create(buffer, { executionProviders: ["wasm"] });
      });
    } else {
      sessionPromise = ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      }).then((s) => { modelReady = true; return s; });
    }
  }
  return sessionPromise;
}

export function isModelReady() {
  return modelReady;
}

// Kick off a silent background preload with no progress callback
getSession().catch(() => {});

export async function processImage(imageSrc, sensitivity, onProgress) {
  // If model isn't loaded yet, show download progress (0-50%), then inference (50-100%)
  const needsDownload = !modelReady;
  const downloadProgress = needsDownload
    ? (pct) => onProgress && onProgress({ stage: "Downloading model", pct: Math.round(pct * 0.5) })
    : null;
  const session = await getSession(downloadProgress);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        let width = img.width;
        let height = img.height;
        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const inferenceProgress = (pct) => onProgress && onProgress({
          stage: "Processing image",
          pct: needsDownload ? 50 + Math.round(pct * 0.5) : pct,
        });
        const outputData = await tiledInference(session, ctx, width, height, inferenceProgress);

        // Auto-levels + contrast stretch
        let minVal = Infinity, maxVal = -Infinity;
        for (let i = 0; i < outputData.length; i++) {
          if (outputData[i] < minVal) minVal = outputData[i];
          if (outputData[i] > maxVal) maxVal = outputData[i];
        }
        const range = maxVal - minVal || 1;
        const blackPoint = 0.3 + sensitivity * 0.55;

        const outPixels = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const norm = (outputData[i] - minVal) / range;
          const val = Math.min(255, Math.max(0, ((norm - (1 - blackPoint)) / blackPoint) * 255));
          outPixels[i * 4] = val;
          outPixels[i * 4 + 1] = val;
          outPixels[i * 4 + 2] = val;
          outPixels[i * 4 + 3] = 255;
        }

        ctx.putImageData(new ImageData(outPixels, width, height), 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("ONNX inference error:", err);
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

// Split image into overlapping 512x512 tiles, run inference on each,
// blend overlaps with a linear weight ramp so seams are invisible
async function tiledInference(session, ctx, width, height, onProgress) {
  const TILE = 512;
  const OVERLAP = 64; // overlap on each edge to avoid hard seams
  const STEP = TILE - OVERLAP * 2;

  const output = new Float32Array(width * height);
  const weight = new Float32Array(width * height);

  // Build a 1D weight ramp for blending overlap regions
  const ramp = new Float32Array(TILE);
  for (let i = 0; i < TILE; i++) {
    const t = i / (TILE - 1);
    // Smooth step: rises over first OVERLAP px, flat in middle, falls over last OVERLAP px
    const left = Math.min(1, i / OVERLAP);
    const right = Math.min(1, (TILE - 1 - i) / OVERLAP);
    ramp[i] = Math.min(left, right);
  }

  const xs = getTileStarts(width, TILE, STEP);
  const ys = getTileStarts(height, TILE, STEP);
  const totalTiles = xs.length * ys.length;
  let doneTiles = 0;

  for (const ty of ys) {
    for (const tx of xs) {
      const tw = Math.min(TILE, width - tx);
      const th = Math.min(TILE, height - ty);

      // Extract tile pixels
      const tileImageData = ctx.getImageData(tx, ty, tw, th);
      const d = tileImageData.data;

      // Pad to full TILE x TILE if edge tile is smaller
      const tensor = new Float32Array(3 * TILE * TILE);
      for (let row = 0; row < TILE; row++) {
        for (let col = 0; col < TILE; col++) {
          const srcRow = Math.min(row, th - 1);
          const srcCol = Math.min(col, tw - 1);
          const si = (srcRow * tw + srcCol) * 4;
          const di = row * TILE + col;
          tensor[di] = d[si] / 255;
          tensor[TILE * TILE + di] = d[si + 1] / 255;
          tensor[2 * TILE * TILE + di] = d[si + 2] / 255;
        }
      }

      const input = new ort.Tensor("float32", tensor, [1, 3, TILE, TILE]);
      const results = await session.run({ input });
      const tileOut = results["output"].data;

      doneTiles++;
      if (onProgress) onProgress(Math.round((doneTiles / totalTiles) * 100));

      // Accumulate into output with blend weights
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

  // Normalise by accumulated weights
  for (let i = 0; i < output.length; i++) {
    if (weight[i] > 0) output[i] /= weight[i];
  }

  return output;
}

function getTileStarts(size, tileSize, step) {
  const starts = [];
  for (let s = 0; s < size; s += step) {
    starts.push(Math.min(s, Math.max(0, size - tileSize)));
    if (s + tileSize >= size) break;
  }
  // Deduplicate
  return [...new Set(starts)];
}
