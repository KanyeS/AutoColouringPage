import { useState } from "react";
import ImageUpload from "./components/ImageUpload";
import Preview from "./components/Preview";
import Controls from "./components/Controls";
import { processImage } from "./utils/imageProcessor";

export default function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = async (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSensitivityChange = async (value) => {
    setSensitivity(value);
    if (originalImage) {
      await applyProcessing(originalImage, value);
    }
  };

  const applyProcessing = async (image, sens) => {
    setIsProcessing(true);
    try {
      const processed = await processImage(image, sens);
      setProcessedImage(processed);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Processing failed. The AI model (~17MB) needs to download on first use — check your internet connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadComplete = async (file) => {
    await handleImageUpload(file);
    const reader = new FileReader();
    reader.onload = async (e) => {
      await applyProcessing(e.target.result, sensitivity);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-top">
          <div>
            <h1>Auto Colouring Page</h1>
            <p>Transform your images into printable coloring pages</p>
          </div>
          <a
            href="https://buymeacoffee.com/kanyes"
            target="_blank"
            rel="noopener noreferrer"
            className="donate-btn"
            title="Buy Me A Coffee"
          >
            ❤️ Support
          </a>
        </div>
      </header>

      <main>
        {!originalImage ? (
          <ImageUpload onUpload={handleUploadComplete} />
        ) : (
          <div className="editor-container">
            <Preview
              original={originalImage}
              processed={processedImage}
              isProcessing={isProcessing}
            />
            <Controls
              sensitivity={sensitivity}
              onSensitivityChange={handleSensitivityChange}
              processedImage={processedImage}
              onNewImage={() => {
                setOriginalImage(null);
                setProcessedImage(null);
              }}
            />
          </div>
        )}
      </main>

      <footer>
        <p>© 2026 Auto Colouring Page</p>
      </footer>
    </div>
  );
}
