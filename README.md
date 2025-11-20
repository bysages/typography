# Typography

![GitHub](https://img.shields.io/github/license/bysages/typography)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

> Typography toolkit featuring Unicode confusables detection and string normalization

## Packages

This is a monorepo that contains the following packages:

- **[unconfusables](./packages/unconfusables/README.md)** - Unicode confusables detection and string normalization library
- **[unocr](./packages/unocr/README.md)** - Unified OCR library with multi-driver support for Tesseract.js

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/bysages/typography.git
cd typography

# Install dependencies
pnpm install
```

### Basic Usage

```typescript
// Unicode confusables detection with unconfusables
import { getConfusables, normalizeString, areConfusable } from "unconfusables";

console.log(getConfusables("0")); // { source: "0", target: ["O"], type: "MA" }
console.log(normalizeString("paypa1")); // "paypal"
console.log(areConfusable("0l", "Ol")); // true

// OCR with unocr
import { createOCRManager } from "unocr";
import tesseractDriver from "unocr/drivers/tesseract";
import { toString } from "hast-util-to-string";

const ocr = createOCRManager({
  driver: tesseractDriver({ langs: "eng" }),
});

const result = await ocr.recognize(imageBuffer);
const text = toString(result);
console.log(text); // Extracted text
```

### Development

```bash
# Development mode
pnpm dev

# Build the project
pnpm build

# Run linting
pnpm lint

# Test unconfusables functionality
node playground/unconfusables.ts

# Test unocr functionality
node playground/unocr/tesseract.ts
```

## Contributing

We welcome contributions! Here's how to get started:

### Quick Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/typography.git
   cd typography
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/bysages/typography.git
   ```

4. **Install dependencies**:

   ```bash
   pnpm install
   ```

5. **Development mode**:

   ```bash
   pnpm dev
   ```

### Development Workflow

1. **Code**: Follow our project standards
2. **Test**: `pnpm build`
3. **Commit**: Use conventional commits (`feat:`, `fix:`, etc.)
4. **Push**: Push to your fork
5. **Submit**: Create a Pull Request to upstream repository

## Support & Community

- 📫 [Report Issues](https://github.com/bysages/typography/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

Built with ❤️ by [By Sages](https://www.bysages.com/)
