import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["packages/**/*.{spec,test}.ts"],
    sequence: {
      concurrent: true,
    },
  },
  fmt: {
    sortImports: {
      type: "natural",
    },
    sortPackageJson: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
