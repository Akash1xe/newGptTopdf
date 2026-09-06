import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Manifest must use MV3");
const expectedPermissions = ["activeTab", "storage"];
for (const permission of manifest.permissions ?? []) {
  if (!expectedPermissions.includes(permission)) throw new Error(`Unexpected permission: ${permission}`);
}
for (const permission of expectedPermissions) {
  if (!(manifest.permissions ?? []).includes(permission)) throw new Error(`Required permission missing: ${permission}`);
}
if (!manifest.content_scripts?.[0]?.matches?.includes("https://chatgpt.com/*")) throw new Error("ChatGPT content-script match missing");
if ((manifest.host_permissions ?? []).includes("<all_urls>")) throw new Error("Broad host permission is not allowed");
const csp = manifest.content_security_policy?.extension_pages ?? "";
if (!csp.includes("script-src 'self'")) throw new Error("Extension CSP must restrict scripts to self");
if (/unsafe-eval/i.test(csp)) throw new Error("unsafe-eval is forbidden");

const forbiddenRuntime = /\b(eval\s*\(|new\s+Function\s*\(|XMLHttpRequest\b|WebSocket\s*\(|sendBeacon\s*\(|fetch\s*\()/;
const remoteScript = /<script[^>]+src=["']https?:\/\//i;
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:API_KEY|SECRET|PASSWORD)\s*=\s*["'][^"']{12,}["']/i
];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (/\.(ts|tsx|js|jsx|html)$/.test(path)) {
      const source = await readFile(path, "utf8");
      if (forbiddenRuntime.test(source)) throw new Error(`Forbidden runtime construct found in ${path}`);
      if (remoteScript.test(source)) throw new Error(`Remote executable script found in ${path}`);
      for (const pattern of secretPatterns) if (pattern.test(source)) throw new Error(`Possible secret found in ${path}`);
    }
  }
}
await walk("src");
await walk("public");
console.log("Static extension validation passed.");
