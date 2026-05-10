import { useEffect, useRef, useState } from "react";

export default function Preview({ original, processed, isProcessing, progress }) {
  const [displayPct, setDisplayPct] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    if (!isProcessing) {
      setDisplayPct(100);
      const t = setTimeout(() => setDisplayPct(0), 400);
      return () => clearTimeout(t);
    }

    // Crawl to 90% over ~40 seconds, slowing as it approaches the ceiling
    setDisplayPct(0);
    let current = 0;
    const tick = () => {
      current += (90 - current) * 0.012;
      setDisplayPct(Math.round(current * 10) / 10);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isProcessing]);

  return (
    <div className="preview-container">
      <div className="preview-panel">
        <h3>Original</h3>
        <div className="image-wrapper">
          {original && <img src={original} alt="Original" />}
        </div>
      </div>

      <div className="preview-panel">
        <h3>Coloring Page</h3>
        <div className="image-wrapper">
          {isProcessing && (
            <div className="progress-container">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${displayPct}%` }}
                />
              </div>
              <p className="progress-label">
                {progress.stage || "Starting..."}
              </p>
            </div>
          )}
          {processed && !isProcessing && (
            <img src={processed} alt="Processed" />
          )}
          {!processed && !isProcessing && (
            <p className="placeholder">Processing...</p>
          )}
        </div>
      </div>
    </div>
  );
}
