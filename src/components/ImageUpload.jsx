import { useRef } from "react";

export default function ImageUpload({ onUpload }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      onUpload(file);
    } else {
      alert("Please select a valid image file");
    }
  };

  return (
    <div className="upload-container">
      <div
        className="upload-box"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("drag-over");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("drag-over");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drag-over");
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith("image/")) {
            onUpload(file);
          }
        }}
      >
        <svg
          className="upload-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <h2>Upload Image</h2>
        <p>Drag and drop your image here or click to browse</p>
        <p className="file-types">Supported: JPG, PNG, WebP</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
