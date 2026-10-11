import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      "drivers/ai": "src/drivers/ai.ts",
      "drivers/tesseract": "src/drivers/tesseract.ts",
    },
  },
});
