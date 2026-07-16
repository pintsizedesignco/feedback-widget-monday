import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    // ESM-only: shipping both ESM and CJS builds of a package that uses React
    // context/hooks (via Radix Dialog) risks a dual-package hazard — a
    // bundler that ends up loading both formats for the same package treats
    // them as two separate module instances, splitting React's internal
    // dispatcher and producing "Invalid hook call" errors that have nothing
    // to do with an actual duplicate react install.
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom", "@radix-ui/react-dialog"],
  },
  {
    entry: { "server/index": "server/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    external: ["express", "multer"],
  },
]);
