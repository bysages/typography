# unocr

![npm version](https://img.shields.io/npm/v/unocr)
![npm downloads](https://img.shields.io/npm/dw/unocr)
![npm license](https://img.shields.io/npm/l/unocr)

> The OCR layer of By Sages Typography — one manager and result model for native system engines, Tesseract, browser Shape Detection, and AI vision models, with universal image input and structured output.

## Features

- 🚗 **One API, many engines** — choose a driver explicitly or let `auto` probe native OCR, the Tesseract CLI, and Tesseract.js in order; AI remains an explicit opt-in model.
- 🧾 **Structured results** — drivers normalize engine output into an OCR document; consume it as escaped HTML by default or as a typed hast tree with `outputType: "hast"`.
- 🖼 **Universal input** — URLs, data URLs, blobs, streams, responses, and binary views are normalized through `undio`, so drivers do not each need bespoke file handling.
- ⚡ **Batch-aware execution** — managers reuse workers where possible, schedule parallel recognition, expose `dispose()`, and keep long-running Tesseract work off your application code.
- 🖥 **Real system OCR** — VisionKit on macOS and Windows Media OCR are available through an optional native peer; no model download is required where the OS provides the engine.
- 🤖 **AI when needed** — connect any AI SDK-compatible vision model and prompt it for structured HTML while keeping the same downstream result API.

## Installation

```bash
# pnpm
pnpm add unocr
pnpm add tesseract.js

# npm
npm install unocr tesseract.js

# yarn
yarn add unocr tesseract.js

# bun
bun add unocr tesseract.js
```

Only install the engine you need: `tesseract.js`, `@napi-rs/system-ocr`, and `ai` are optional peer dependencies. The CLI driver uses a locally installed `tesseract` binary, and the browser driver uses the Shape Detection API directly.

## Driver Selection

| Driver      | Runtime                 | Engine / dependency         | Best for                                   |
| ----------- | ----------------------- | --------------------------- | ------------------------------------------ |
| `auto`      | Node                    | native → CLI → Tesseract.js | applications that should work across hosts |
| `native`    | Node (macOS / Windows)  | `@napi-rs/system-ocr`       | fast OS OCR without downloading models     |
| `cli`       | Node                    | `tesseract` executable      | existing local Tesseract installations     |
| `tesseract` | Node / browser / worker | `tesseract.js`              | portable WASM OCR and workers              |
| `web`       | Browser                 | Shape Detection API         | browsers that expose `TextDetector`        |
| `ai`        | Universal               | AI SDK vision model         | complex layouts when a model is acceptable |

## Quick Start

Let the runtime pick an available backend:

```ts
import { createOCRManager } from "unocr";
import autoDriver from "unocr/drivers/auto";

const ocr = createOCRManager({ driver: autoDriver() });
const result = await ocr.recognize(image);
const results = await ocr.recognizes(images, { parallel: 4 }); // bounded by 4 by default
await ocr.dispose();
```

Pin Tesseract.js when predictable WASM behavior matters more than host-specific speed:

```ts
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

const ocr = createOCRManager({
  driver: tesseractDriver({
    langs: ["eng", "chi_sim"],
    logger: (message) => console.log(message),
  }),
});

const result = await ocr.recognize(image);
await ocr.dispose();
```

For document-oriented processing, request hast instead of parsing HTML again:

```ts
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";

const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng", outputType: "hast" }),
});
```

## License

- [MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
