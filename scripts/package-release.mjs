import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const outputDir = resolve("release");
const output = resolve(outputDir, "chatgpt-to-pdf-v1.0.0.zip");
await mkdir(outputDir, { recursive: true });
await rm(output, { force: true });

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

if (process.platform === "win32") {
  const dist = resolve("dist", "*");
  await run("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${dist}' -DestinationPath '${output}' -Force`]);
} else {
  await run("zip", ["-rq", output, "."], { cwd: resolve("dist") });
}
console.log(`Created ${output}`);
