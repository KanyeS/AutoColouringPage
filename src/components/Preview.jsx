export default function Preview({ original, processed, isProcessing }) {
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
          {isProcessing && <div className="spinner"></div>}
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
