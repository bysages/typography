# unocr 🦜

![npm version](https://img.shields.io/npm/v/unocr)
![npm downloads](https://img.shields.io/npm/dw/unocr)
![npm license](https://img.shields.io/npm/l/unocr)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

Unified OCR library with multi-driver support for Tesseract.js and PaddleOCR, providing structured text extraction using hast-based output format.

## ✨ Features

- 🔍 **Multi-Engine Support**: Tesseract.js and PaddleOCR drivers with unified interface
- 📝 **Structured Output**: Hast-based OCR results for rich document structure
- 🌐 **Universal Input**: Support for various image formats via undio integration
- ⚡️ **High Performance**: Parallel processing with scheduler support
- 🔄 **Batch Processing**: Efficient batch OCR operations with configurable parallelism
- 🛡️ **TypeScript**: Full TypeScript support with comprehensive type definitions
- 🎯 **Driver Architecture**: Extensible driver system for easy engine integration
- 📊 **Rich Metadata**: Comprehensive processing metadata and engine information
- 🔧 **Flexible Options**: Customizable OCR options for different use cases

## 📥 Installation

```bash
# Using npm
npm install unocr

# Using yarn
yarn add unocr

# Using pnpm
pnpm add unocr
```

## 🚀 Basic Usage

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";
import type { Driver } from "unocr";

// Create OCR driver
const driver: Driver = tesseractDriver({
  langs: ["eng", "chi_sim"], // English and Chinese
  logger: (m) => console.log(m), // Progress logging
});

// Single image OCR
const result = await driver.recognize(imageBuffer);
console.log(result); // hast Root object

// Batch OCR with parallel processing
const results = await driver.recognizes(imageArray, { parallel: 4 });
console.log(results); // Array of hast Root objects

// Clean up
await driver.dispose();
```

## 🔧 Advanced Usage

### 🎯 Custom Driver Configuration

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";

// Advanced Tesseract configuration
const driver = tesseractDriver({
  langs: ["eng", "fra", "deu"],
  oem: 1, // LSTM only
  corePath: "./tesseract-core",
  langPath: "./lang-data",
  cacheMethod: "write",
  logger: (progress) => {
    if (progress.status === "recognizing text") {
      console.log(`Progress: ${progress.progress * 100}%`);
    }
  },
});

const result = await driver.recognize(image, {
  rectangle: { top: 100, left: 100, width: 500, height: 300 },
});
```

### 📊 Batch Processing with Custom Parallelism

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";

const driver = tesseractDriver({ langs: "eng" });

// Process many images efficiently
const images = [image1, image2, image3, image4, image5];

// Use 2 workers for lower resource usage
const results = await driver.recognizes(images, { parallel: 2 });

// Use maximum parallelism (up to image count)
const maxResults = await driver.recognizes(images, { parallel: images.length });

await driver.dispose();
```

### 🌐 Input Format Support

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";

const driver = tesseractDriver({ langs: "eng" });

// Various input formats supported via undio
const imageInputs = [
  "https://example.com/image.jpg", // URL
  Buffer.from(imageData), // Buffer
  Uint8Array.from(imageData), // Uint8Array
  base64String, // Base64 data URL
  fileObject, // File/Blob
  imageElement, // HTMLImageElement
];

const results = await driver.recognizes(imageInputs);
await driver.dispose();
```

### 🔍 Working with Hast Output

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";
import { toHtml } from "hast-util-to-html";

const driver = tesseractDriver({ langs: "eng" });

const result = await driver.recognize(image);

// Convert hast to HTML
const html = toHtml(result);
console.log(html);
// <div class="ocr_page">...</div>

// Extract text content
function extractText(node): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.children) {
    return node.children.map(extractText).join("");
  }
  return "";
}

const text = extractText(result);
console.log(text);
// "Extracted text content"

await driver.dispose();
```

## 📚 API Reference

### 🔧 Driver Interface

#### `Driver<OptionsT = DriverOptions>`

Core interface for OCR drivers with unified API.

```typescript
interface Driver<OptionsT = DriverOptions> {
  name?: string;
  options?: OptionsT;

  recognize: (input: OCRInput) => MaybePromise<OCRResult>;
  recognizes?: (
    inputs: OCRInput[],
    options?: RecognizesOptions,
  ) => MaybePromise<OCRResult[]>;
  dispose?: () => MaybePromise<void>;
}
```

### 🖼️ Input and Output Types

#### `OCRInput`

Universal input type supporting various image formats via undio integration.

#### `OCRResult`

Structured OCR output in hast format for rich document structure.

### 🚗 Driver Creation

#### `tesseractDriver(options?): Driver`

Create a Tesseract.js-based OCR driver.

```typescript
import { tesseractDriver } from "unocr/drivers/tesseract";

const driver = tesseractDriver({
  langs: "eng",
  oem: 1,
  logger: console.log,
});

const result = await driver.recognize(image);
const results = await driver.recognizes(images, { parallel: 4 });
```

## ⚡ Performance

### 📊 Benchmarks

- 🚀 **Multi-Engine Support**: Leverage optimal engine for specific use cases
- ⚡️ **Parallel Processing**: Configurable parallel worker execution
- 📦 **Efficient Memory**: Worker reuse and proper cleanup
- 🔄 **Batch Operations**: Optimized batch processing with scheduler

### 🎯 Performance Tips

```typescript
// Reuse drivers for multiple operations
const driver = tesseractDriver({ langs: "eng" });

// Batch process when possible
const results = await driver.recognizes(images, { parallel: 4 });

// Configure appropriate parallelism based on hardware
const cpuCount = navigator.hardwareConcurrency || 4;
const results = await driver.recognizes(images, { parallel: cpuCount });

await driver.dispose();
```

## 🔧 Configuration

### Batch Processing

Configure parallel processing for batch operations:

```typescript
// Process with 2 workers (conservative)
await driver.recognizes(images, { parallel: 2 });

// Process with 8 workers (high performance)
await driver.recognizes(images, { parallel: 8 });
```

## 🌐 Ecosystem Integration

### 📝 Hast Processing

```typescript
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import { rehype } from "rehype";
import { unified } from "unified";

const processor = rehype();
const result = await driver.recognize(image);

// Convert to HTML
const html = toHtml(result);

// Extract text
const text = await processor.process(result);

// Custom processing
const processed = unified().use(myPlugin).processSync(result);
```

### 🔗 Framework Integration

```typescript
// Express.js route
app.post("/ocr", async (req, res) => {
  const driver = tesseractDriver({ langs: "eng" });

  try {
    const result = await driver.recognize(req.file.buffer);
    res.json({ success: true, result });
  } finally {
    await driver.dispose();
  }
});

// Cloudflare Workers
export default {
  async fetch(request) {
    const driver = tesseractDriver({ langs: "eng" });
    const image = await request.arrayBuffer();
    const result = await driver.recognize(image);
    await driver.dispose();

    return new Response(JSON.stringify(result));
  },
};
```

## 🔗 Related

- [Tesseract.js](https://github.com/naptha/tesseract.js) - JavaScript OCR library
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) - OCR toolkit
- [undio](https://github.com/unjs/undio) - Universal I/O library
- [Hast](https://github.com/syntax-tree/hast) - HTML Abstract Syntax Tree
- [unjs](https://unjs.io/) - JavaScript ecosystem

## 📄 License

[MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
