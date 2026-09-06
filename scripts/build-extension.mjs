import { build } from "esbuild";

const shared = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: "chrome120",
  platform: "browser",
  format: "iife",
  legalComments: "none"
};

await Promise.all([
  build({ ...shared, entryPoints: ["src/content/contentScript.ts"], outfile: "dist/assets/content.js" }),
  build({ ...shared, entryPoints: ["src/background/background.ts"], outfile: "dist/assets/background.js" })
]);
