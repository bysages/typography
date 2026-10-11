import { wasm } from "rolldown-plugin-wasm";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      subset: "src/subsetter.ts",
    },
    noExternal: [/harfbuzzjs/],
    plugins: [wasm({ targetEnv: "auto" })],
  },
});
