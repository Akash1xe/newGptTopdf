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
if (manifest.manifest_version !== 3) throw new Error("Release manifest is not MV3");
if (manifest.version !== "1.0.0") throw new Error(`Unexpected release version ${manifest.version}`);

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
