let worker = null;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./inferenceWorker.js", import.meta.url), { type: "module" });
  }
  return worker;
}

// Preload the worker (and trigger model download in the background)
getWorker();

export async function processImage(imageSrc, sensitivity, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const maxDim = isMobile ? 768 : 1280;

      let width = img.width;
      let height = img.height;
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
      const imageData = ctx.getImageData(0, 0, width, height).data;

      const w = getWorker();

      w.onmessage = (e) => {
        const { type } = e.data;
        if (type === "download") {
          onProgress && onProgress({ stage: "Downloading model", pct: Math.round(e.data.pct * 0.5) });
        } else if (type === "tile") {
          onProgress && onProgress({ stage: "Processing image", pct: 50 + Math.round(e.data.pct * 0.5) });
        } else if (type === "done") {
          const { outPixels, width: w, height: h } = e.data;
          const outCanvas = document.createElement("canvas");
          outCanvas.width = w;
          outCanvas.height = h;
          outCanvas.getContext("2d").putImageData(new ImageData(outPixels, w, h), 0, 0);
          resolve(outCanvas.toDataURL("image/png"));
        } else if (type === "error") {
          reject(new Error(e.data.message));
        }
      };

      w.postMessage({ imageData, width, height, sensitivity, isMobile }, [imageData.buffer]);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}
