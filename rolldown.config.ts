import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/index.ts",
  resolve: {
    alias: {
      "jsonc-parser": "jsonc-parser/lib/esm/main.js",
    },
  },
  output: {
    dir: "dist",
    format: "esm",
    banner: "#!/usr/bin/env node",
  },
  platform: "node",
});
