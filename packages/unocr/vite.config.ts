import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      "drivers/ai": "src/drivers/ai.ts",
      "drivers/auto": "src/drivers/auto.ts",
      "drivers/auto.browser": "src/drivers/auto.browser.ts",
      "drivers/cli": "src/drivers/cli.ts",
      "drivers/native": "src/drivers/native.ts",
      "drivers/tesseract": "src/drivers/tesseract.ts",
      "drivers/web": "src/drivers/web.ts",
    },
  },
});
