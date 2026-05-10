import * as ort from "onnxruntime-web";

const MODEL_URL =
  "https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx";

let sessionPromise = null;

function getSession() {
  if (!sessionPromise) {
    ort.env.wasm.proxy = false;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    });
  }
  return sessionPromise;
}

// Preload the model as soon as the module is imported
getSession().catch(() => {});

export async function processImage(imageSrc, sensitivity) {
  const session = await getSession();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        // Cap size — model runs on CPU so keep it reasonable
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;
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
        const imageData = ctx.getImageData(0, 0, width, height);
        const d = imageData.data;

        // Build NCHW float32 tensor, normalised 0-1
        const tensor = new Float32Array(3 * height * width);
        for (let i = 0; i < height * width; i++) {
          tensor[i] = d[i * 4] / 255;                   // R plane
          tensor[height * width + i] = d[i * 4 + 1] / 255; // G plane
          tensor[2 * height * width + i] = d[i * 4 + 2] / 255; // B plane
        }

        const input = new ort.Tensor("float32", tensor, [1, 3, height, width]);
        const results = await session.run({ input });
        const out = results["output"];

        // out.data is float32 greyscale 0-1; 0=black line, 1=white background
        // Find the actual min/max of this image's output so we use the full range
        let minVal = Infinity, maxVal = -Infinity;
        for (let i = 0; i < out.data.length; i++) {
          if (out.data[i] < minVal) minVal = out.data[i];
          if (out.data[i] > maxVal) maxVal = out.data[i];
        }
        const range = maxVal - minVal || 1;

        // sensitivity 0=bold (low black point) .. 1=fine (high black point)
        // blackPoint controls where we clip to pure black — lower = more lines kept
        const blackPoint = 0.3 + sensitivity * 0.55; // 0.30..0.85

        const outData = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          // Normalise to 0-1 using actual range, then apply contrast curve
          const norm = (out.data[i] - minVal) / range;
          // Remap: anything below blackPoint gets crushed to 0 (black line),
          // above it gets stretched to 255 (white background)
          const val = Math.min(255, Math.max(0, ((norm - (1 - blackPoint)) / blackPoint) * 255));
          outData[i * 4] = val;
          outData[i * 4 + 1] = val;
          outData[i * 4 + 2] = val;
          outData[i * 4 + 3] = 255;
        }

        ctx.putImageData(new ImageData(outData, width, height), 0, 0);
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
