# unocr 🦜

![npm version](https://img.shields.io/npm/v/unocr)
![npm downloads](https://img.shields.io/npm/dw/unocr)
![npm license](https://img.shields.io/npm/l/unocr)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

Unified OCR library with multi-driver support for Tesseract.js and AI vision models, providing structured text extraction using hast-based output format.

## ✨ Features

- 🔍 **Multi-Engine Support**: Tesseract.js and AI vision drivers with unified interface
- 📝 **Structured Output**: Hast-based OCR results for rich document structure
- 🌐 **Universal Input**: Support for various image formats via undio integration
- ⚡️ **High Performance**: Parallel processing with scheduler support
- 🔄 **Batch Processing**: Efficient batch OCR operations with configurable parallelism
- 🛡️ **TypeScript**: Full TypeScript support with comprehensive type definitions
- 🎯 **Driver Architecture**: Extensible driver system for easy engine integration
- 🤖 **AI-Powered**: Advanced AI vision models for enhanced OCR accuracy
- 🔧 **Flexible AI Configuration**: Customizable system prompts and model parameters
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

### Tesseract.js Driver

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

// Create OCR manager with Tesseract driver
const ocr = createOCRManager({
  driver: tesseractDriver({
    langs: ["eng", "chi_sim"], // English and Chinese
    logger: (m) => console.log(m), // Progress logging
  }),
});

// Single image OCR
const result = await ocr.recognize(imageBuffer);
console.log(result); // hast Root object

// Batch OCR with parallel processing
const results = await ocr.recognizes(imageArray, { parallel: 4 });
console.log(results); // Array of hast Root objects

// Clean up
await ocr.dispose();
```

### AI Vision Driver

```typescript
import { createOCRManager } from "unocr";
import aiDriver from "unocr/drivers/ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Create AI model client
const openai = createOpenAICompatible({
  name: "openai",
  baseURL:
    process.env.OPENAI_COMPATIBLE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

const modelName = process.env.AI_MODEL || "qwen3-vl-flash";

// Create OCR manager with AI driver
const ocr = createOCRManager({
  driver: aiDriver({
    model: openai(modelName),
    system:
      "Extract all text from this image and return it as HTML. Use appropriate tags like h1-h6 for headings, p for paragraphs, and ul/ol for lists.",
  }),
});

// Single image OCR with AI
const result = await ocr.recognize(imageBuffer);
console.log(result); // hast Root object

// Batch OCR with AI
const results = await ocr.recognizes(imageArray, { parallel: 2 });
console.log(results); // Array of hast Root objects

// Clean up
await ocr.dispose();
```

## 🔧 Advanced Usage

### 🎯 Custom Driver Configuration

#### Tesseract.js Advanced Configuration

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

// Advanced Tesseract configuration
const ocr = createOCRManager({
  driver: tesseractDriver({
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
  }),
});

const result = await ocr.recognize(image);
```

#### AI Vision Custom Configuration

```typescript
import { createOCRManager } from "unocr";
import aiDriver from "unocr/drivers/ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const openai = createOpenAICompatible({
  name: "openai",
  baseURL:
    process.env.OPENAI_COMPATIBLE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

const modelName = process.env.AI_MODEL || "qwen3-vl-flash";

// Advanced AI configuration
const ocr = createOCRManager({
  driver: aiDriver({
    model: openai(modelName),
    system:
      "You are an expert OCR system. Extract all visible text with precise formatting and return it as structured HTML.",
    temperature: 0.1,
    maxOutputTokens: 4000,
    maxRetries: 3,
  }),
});

const result = await ocr.recognize(image);
```

### 📊 Batch Processing with Custom Parallelism

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

// Process many images efficiently
const images = [image1, image2, image3, image4, image5];

// Use 2 workers for lower resource usage
const results = await ocr.recognizes(images, { parallel: 2 });

// Use maximum parallelism (up to image count)
const maxResults = await ocr.recognizes(images, { parallel: images.length });

await ocr.dispose();
```

### 🌐 Input Format Support

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

// Various input formats supported via undio
const imageInputs = [
  "https://example.com/image.jpg", // URL (string)
  ArrayBuffer, // ArrayBufferLike
  Uint8Array.from([]), // Uint8Array
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA", // Base64 data URL
  new Blob(), // Blob
  new ReadableStream(), // ReadableStream
  new Response(), // Response
];

const results = await ocr.recognizes(imageInputs);
await ocr.dispose();
```

### 🔍 Working with Hast Output

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";
import { toHtml } from "hast-util-to-html";

const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

const result = await ocr.recognize(image);

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

await ocr.dispose();
```

## 📚 API Reference

### 🔧 Manager Creation

#### `createOCRManager(options: OCRManagerOptions)`

Create an OCR manager with unified API for text recognition.

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

const ocr = createOCRManager({
  driver: tesseractDriver({
    langs: "eng",
    logger: console.log,
  }),
});

const result = await ocr.recognize(image);
const results = await ocr.recognizes(images, { parallel: 4 });
await ocr.dispose();
```

### 🖼️ Input and Output Types

#### `OCRInput`

Universal input type supporting various image formats via undio integration:

- `string` - URLs or base64 data URLs
- `ArrayBufferLike` - ArrayBuffer and similar types
- `Uint8Array` - Typed array data
- `Blob` - File/Blob objects
- `ReadableStream` - Stream data
- `Response` - Fetch API Response objects

#### `OCRResult`

Structured OCR output in hast format for rich document structure.

### 🚗 Available Drivers

#### `tesseractDriver(options?: TesseractOptions)`

Create a Tesseract.js-based OCR driver with advanced configuration options.

#### `aiDriver(options?: AIDriverOptions)`

Create an AI vision-based OCR driver with support for multimodal AI models like GPT-4 Vision.

**AI Driver Options:**

- `model` - AI model instance (from @ai-sdk/openai-compatible or other AI SDK providers)
- `system` - System prompt for text extraction instructions
- `temperature` - Response randomness (0-1)
- `maxOutputTokens` - Maximum tokens in AI response
- `maxRetries` - Number of retry attempts on failure
- Additional AI SDK parameters supported

## ⚡ Performance

### 📊 Benchmarks

- 🚀 **Multi-Engine Support**: Choose between traditional OCR and AI vision models
- ⚡️ **Parallel Processing**: Configurable parallel worker execution
- 📦 **Efficient Memory**: Worker reuse and proper cleanup
- 🔄 **Batch Operations**: Optimized batch processing with scheduler
- 🤖 **AI Accuracy**: Enhanced text recognition with AI vision models
- 🔧 **Flexible Processing**: Local Tesseract for speed, AI for complex layouts

### 🎯 Performance Tips

```typescript
// Reuse OCR manager for multiple operations
const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

// Batch process when possible
const results = await ocr.recognizes(images, { parallel: 4 });

// Configure appropriate parallelism based on hardware
const cpuCount = navigator.hardwareConcurrency || 4;
const results = await ocr.recognizes(images, { parallel: cpuCount });

// Choose driver based on use case
const fastOcr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }), // Fast for simple documents
});

const accurateOcr = createOCRManager({
  driver: aiDriver({ model: openai(modelName) }), // Better for complex layouts
});

await ocr.dispose();
```

## 🔧 Configuration

### Batch Processing

Configure parallel processing for batch operations:

```typescript
const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

// Process with 2 workers (conservative)
await ocr.recognizes(images, { parallel: 2 });

// Process with 8 workers (high performance)
await ocr.recognizes(images, { parallel: 8 });
```

## 🌐 Ecosystem Integration

### 📝 Hast Processing

```typescript
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";
import aiDriver from "unocr/drivers/ai";
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import { rehype } from "rehype";
import { unified } from "unified";

// Works with both Tesseract and AI drivers
const tesseractOcr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

const aiOcr = createOCRManager({
  driver: aiDriver({ model: openai(modelName) }),
});

const processor = rehype();

// Process with Tesseract
const tesseractResult = await tesseractOcr.recognize(image);
const tesseractHtml = toHtml(tesseractResult);

// Process with AI
const aiResult = await aiOcr.recognize(image);
const aiHtml = toHtml(aiResult);

// Both outputs are compatible hast format
const text = await processor.process(aiResult);
const processed = unified().use(myPlugin).processSync(tesseractResult);
```

## 🔗 Related

- [Tesseract.js](https://github.com/naptha/tesseract.js) - JavaScript OCR library
- [Vercel AI SDK](https://github.com/vercel/ai-sdk) - AI model integration toolkit
- [undio](https://github.com/unjs/undio) - Universal I/O library
- [Hast](https://github.com/syntax-tree/hast) - HTML Abstract Syntax Tree
- [unjs](https://unjs.io/) - JavaScript ecosystem

## 📄 License

[MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
