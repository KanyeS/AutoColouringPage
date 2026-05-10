export default function Controls({
  sensitivity,
  onSensitivityChange,
  processedImage,
  onNewImage,
}) {
  const handleDownload = () => {
    if (!processedImage) return;

    const link = document.createElement("a");
    link.href = processedImage;
    link.download = `coloring-page-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!processedImage) return;

    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>Coloring Page</title>
          <style>
            body { margin: 0; padding: 20px; }
            img { max-width: 100%; height: auto; }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <img src="${processedImage}" alt="Coloring Page" />
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="controls-container">
      <div className="control-group">
        <label htmlFor="sensitivity">Line Threshold</label>
        <div className="slider-wrapper">
          <span className="slider-label">Bold</span>
          <input
            id="sensitivity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="slider-label">Fine</span>
        </div>
        <p className="sensitivity-value">
          {sensitivity < 0.35
            ? "Bold — more lines"
            : sensitivity < 0.65
              ? "Balanced"
              : "Fine — cleaner"}
        </p>
      </div>

      <div className="button-group">
        <button
          onClick={handleDownload}
          disabled={!processedImage}
          className="btn btn-primary"
        >
          Download PNG
        </button>
        <button
          onClick={handlePrint}
          disabled={!processedImage}
          className="btn btn-secondary"
        >
          Print
        </button>
        <button onClick={onNewImage} className="btn btn-tertiary">
          New Image
        </button>
      </div>
    </div>
  );
}
