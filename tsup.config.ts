import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    // Keep react-relying deps external rather than bundled: bundling a package
    // that itself uses React context/hooks (Radix Dialog) risks a dual-package
    // hazard where the consumer's bundler can't tell it's the same React.
    external: ["react", "react-dom", "@radix-ui/react-dialog"],
  },
  {
    entry: { "server/index": "server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["express"],
  },
]);
