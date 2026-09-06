import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "dist/manifest.json",
  "dist/popup.html",
  "dist/print.html",
  "dist/assets/content.js",
  "dist/assets/background.js",
  "dist/icons/icon16.png",
  "dist/icons/icon32.png",
  "dist/icons/icon48.png",
  "dist/icons/icon128.png"
];
for (const path of required) await access(path);
const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Release manifest is not MV3");
if (manifest.version !== pkg.version) throw new Error(`Manifest/package version mismatch: ${manifest.version} vs ${pkg.version}`);

async function collectFiles(dir, out = []) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await collectFiles(path, out); else out.push(path);
  }
  return out;
}

const distFiles = await collectFiles("dist");
const cssFiles = distFiles.filter((path) => path.endsWith(".css"));
let hasKatexCss = false;
for (const cssFile of cssFiles) {
  const css = await readFile(cssFile, "utf8");
  if (/KaTeX_Main|\.katex-display|\.katex\b/.test(css)) { hasKatexCss = true; break; }
}
if (!hasKatexCss) throw new Error("Bundled KaTeX CSS is missing from dist");
const katexFonts = distFiles.filter((path) => /KaTeX_[^/\\]+\.(?:woff2?|ttf)$/i.test(path));
if (katexFonts.length === 0) throw new Error("Bundled KaTeX font assets are missing from dist");

let totalBytes = 0;
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path); else totalBytes += info.size;
  }
}
await walk("dist");
console.log(`Release validation passed. Uncompressed dist size: ${(totalBytes / 1024).toFixed(1)} KiB`);
