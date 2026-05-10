# Auto Colouring Page

A browser-based tool that converts photographs and illustrations into printable coloring page line art. No server, no upload — everything runs locally in the browser.

## How It Works

When you upload an image, it is passed through a neural network that has been trained to extract clean line art from photographs and illustrations. The model runs entirely client-side via WebAssembly, so your image never leaves your device. The first time you use the tool the model weights (~17 MB) are downloaded from HuggingFace and cached by the browser for all subsequent uses.

The line threshold slider controls how much of the model's output is rendered. At the bold end more lines are captured, including faint or soft edges. At the fine end only the strongest, most confident edges are kept, producing a cleaner but sparser result.

Once processed, the result can be downloaded as a PNG or sent directly to a printer.

## Models and Credits

### Informative Drawings

The line art extraction is powered by the Informative Drawings model, originally published by Caroline Chan, Fredo Durand, and Phillip Isola at MIT.

- Paper: "Learning to generate line drawings that convey geometry and semantics" (CVPR 2022)
- Original repository: https://github.com/carolineec/informative-drawings
- ONNX conversion and HuggingFace hosting: Joseph Rocca (https://huggingface.co/rocca/informative-drawings-line-art-onnx)
- JavaScript reference implementation: https://github.com/josephrocca/image-to-line-art-js

The ONNX model is loaded at runtime from:
https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx

### ONNX Runtime Web

Model inference is handled by ONNX Runtime Web, developed by Microsoft.

- https://onnxruntime.ai
- npm: onnxruntime-web

## Tech Stack

- React 19
- Vite
- ONNX Runtime Web

## Running Locally

```
npm install
npm run dev
```

The dev server runs on http://127.0.0.1:5173. An internet connection is required on first use to download the model weights.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

### Third-party licenses

**Informative Drawings** (carolineec/informative-drawings) is licensed under the MIT License, Copyright 2022 Caroline Chan. Attribution is required if you distribute the model weights.

**ONNX Runtime Web** (microsoft/onnxruntime) is licensed under the MIT License, Copyright Microsoft Corporation.

**Rocca's ONNX conversion** (huggingface.co/rocca/informative-drawings-line-art-onnx) does not have an explicit license stated on the model card. The underlying model is MIT licensed. If you intend to distribute this project commercially, you should either convert the model weights yourself from the original repository or contact the author to confirm the terms of the conversion.
